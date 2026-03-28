const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let stats = { totalSum: 0, items: {} }; 
let courierStats = {}; 
let adminState = {}; 

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Vali" }
];

let menu = [
    { id: 'b1', name: '🍔 Burger', price: 30000 },
    { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
    { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
    { id: 'l1', name: '🌯 Lavash', price: 32000 }
];

let carts = {};
let orders = {};
let users = {};

// 2. KLAVIATURALAR
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
    ['📊 Kunlik hisobot', '📦 Faol buyurtmalar'],
    ['🗑 Taomni o\'chirish', '🏠 Mijoz menyusiga o\'tish']
]).resize();

const courierKeyboard = Markup.keyboard([
    ['🏁 Topshirilgan buyurtmalarim'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

// --- FUNKSIYA: ADMINGA BUYURTMA YUBORISH ---
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    if (!order) return;
    let itemsText = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n\n📋 *Tarkibi:*\n${itemsText}\n\n📞 Tel: +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `rej_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// --- START ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) ctx.reply("Admin panel! 🛠", adminKeyboard);
    else if (COURIERS.some(c => c.id === userId)) ctx.reply("Kuryer paneli! 🚗", courierKeyboard);
    else ctx.reply("Coffee Food botiga xush kelibsiz! 👋", mainKeyboard);
});

// --- ADMIN MENYU BOSHQARUVI ---
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'name' };
    ctx.reply("Yangi taom nomini yozing:");
});

bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(i.name, `edit_p_${i.id}`)]);
    ctx.reply("Qaysi taom narxini tahrirlaymiz?", Markup.inlineKeyboard(buttons));
});

bot.hears('🗑 Taomni o\'chirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(`🗑 ${i.name}`, `del_i_${i.id}`)]);
    ctx.reply("O'chirish uchun taomni tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/edit_p_(.+)/, (ctx) => {
    const itemId = ctx.match[1];
    adminState[ctx.from.id] = { step: 'new_price', itemId: itemId };
    ctx.reply("Yangi narxni yozing:");
});

bot.action(/del_i_(.+)/, (ctx) => {
    const itemId = ctx.match[1];
    const index = menu.findIndex(i => i.id === itemId);
    if (index !== -1) {
        const deletedItem = menu[index].name;
        menu.splice(index, 1);
        ctx.editMessageText(`✅ ${deletedItem} menyudan o'chirildi.`);
    }
});

bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = adminState[userId];
    if (!state || userId !== ADMIN_ID) return next();

    if (state.step === 'name') {
        state.name = ctx.message.text;
        state.step = 'price';
        ctx.reply(`${state.name} narxini yozing:`);
    } else if (state.step === 'price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply("Faqat raqam yozing!");
        menu.push({ id: 'm' + Date.now(), name: state.name, price: price });
        delete adminState[userId];
        ctx.reply("✅ Qo'shildi!", adminKeyboard);
    } else if (state.step === 'new_price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply("Faqat raqam yozing!");
        const item = menu.find(i => i.id === state.itemId);
        if (item) item.price = price;
        delete adminState[userId];
        ctx.reply("✅ Narx yangilandi!", adminKeyboard);
    }
});

// --- MIJOZ LOGIKASI ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name}\n${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
});

bot.action(/add_(.+)/, async (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push({ ...item });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒");
    let total = 0;
    let text = "🛒 *Savatchangizda:*\n\n";
    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} — ${i.price.toLocaleString()} so'm\n`;
        total += i.price;
    });
    text += `\n💰 *Jami:* ${total.toLocaleString()} so'm`;
    ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

bot.action('order_start', (ctx) => ctx.reply("📞 Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime()));

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiyangizni yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return;
    const { latitude, longitude } = ctx.message.location;
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);
    const phone = users[userId] ? users[userId].phone : "Noma'lum";

    orders[orderId] = { userId, phone, latitude, longitude, items: [...cart], total, status: 'Yangi', lockCancel: false };

    await ctx.reply(`✅ Buyurtmangiz qabul qilindi (#${orderId}).`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const my = Object.keys(orders).filter(id => orders[id].userId === ctx.from.id);
    if (!my.length) return ctx.reply("Faol buyurtmalar yo'q.");
    my.forEach(id => {
        const order = orders[id];
        let itemsList = order.items.map(i => i.name).join(', ');
        let text = `📦 *Buyurtma #${id}*\n📋 Tarkibi: ${itemsList}\n💰 Jami: ${order.total.toLocaleString()} so'm\n📊 Holati: *${order.status}*`;
        const btn = !order.lockCancel ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${id}`)]]) : null;
        ctx.replyWithMarkdown(text, btn);
    });
});

// --- ADMIN: MAHSULOT TUGAGAN ---
bot.action(/out_list_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        const buttons = order.items.map((item, idx) => [Markup.button.callback(`❌ ${item.name} tugagan`, `confirm_out_${orderId}_${idx}`)]);
        ctx.editMessageText(`Qaysi mahsulot tugaganini tanlang:`, Markup.inlineKeyboard(buttons));
    }
});

bot.action(/confirm_out_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const itemIdx = parseInt(ctx.match[2]);
    const order = orders[orderId];
    if (order && order.items[itemIdx]) {
        const outItem = order.items[itemIdx];
        order.items.splice(itemIdx, 1);
        order.total -= outItem.price;

        if (order.items.length > 0) {
            await bot.telegram.sendMessage(order.userId, `⚠️ Uzr, buyurtmangizdagi *${outItem.name}* tugab qolgan ekan.\n\nQolgan mahsulotlar yuborilaversinmi?`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("✅ Ha, yuborilsin", `user_yes_${orderId}`)],
                    [Markup.button.callback("❌ Yo'q, bekor qilinsin", `user_no_${orderId}`)]
                ])
            });
            ctx.editMessageText(`✅ Mijozga so'rov yuborildi (#${orderId}).`);
        } else {
            await bot.telegram.sendMessage(order.userId, `⚠️ Uzr, mahsulot tugagani uchun buyurtma bekor qilindi.`);
            delete orders[orderId];
            ctx.editMessageText(`❌ #${orderId} bekor qilindi.`);
        }
    }
});

bot.action(/user_yes_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        await ctx.editMessageText("✅ Buyurtmangiz yangilandi!");
        await bot.telegram.sendMessage(ADMIN_ID, `🔄 *MIJOZ ROZI (#${id})*`);
        await sendOrderToAdmin(id);
    }
});

bot.action(/user_no_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        delete orders[id];
        await ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
        await bot.telegram.sendMessage(ADMIN_ID, `❌ Mijoz #${id} buyurtmani rad etdi.`);
    }
});

// --- ADMIN VA KURYER ACTIONLARI ---
bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].lockCancel = true;
        orders[id].status = 'Tayyorlanmoqda';
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtmangiz #${id} tayyorlanmoqda! Uni endi bekor qila olmaysiz. 🔒`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga", `sd_${id}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${id}`)]
        ]).reply_markup);
    }
});

bot.action(/rej_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, "❌ Buyurtmangiz rad etildi.");
        delete orders[id]; ctx.editMessageText(`❌ #${id} rad etildi.`);
    }
});

bot.action(/u_cn_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id] && !orders[id].lockCancel) {
        delete orders[id]; ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
        bot.telegram.sendMessage(ADMIN_ID, `⚠️ Mijoz #${id} buyurtmani bekor qildi.`);
    } else ctx.answerCbQuery("Bekor qilib bo'lmaydi!", { show_alert: true });
});

bot.action(/sd_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${id}_${c.id}`)]);
    ctx.editMessageText(`Kuryerni tanlang:`, Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const cId = ctx.match[2];
    if (orders[id]) {
        orders[id].status = 'Kuryerga berildi';
        bot.telegram.sendMessage(cId, `📦 *YANGI BUYURTMA #${id}*\n💰 ${orders[id].total.toLocaleString()} so'm`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `c_take_${id}`)],
                [Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]
            ])
        });
        bot.telegram.sendLocation(cId, orders[id].latitude, orders[id].longitude);
        ctx.editMessageText(`✅ #${id} kuryerga yuborildi.`);
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].status = 'Yo\'lda 🚚';
        await bot.telegram.sendMessage(orders[id].userId, `🚀 *Buyurtmangiz yo'lda!* \nKuryer buyurtmangizni qabul qildi va yo'lga chiqdi. 🚚`);
        await ctx.answerCbQuery("Mijozga bildirishnoma yuborildi! ✅");
        await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([[Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]]).reply_markup);
    }
});

bot.action(/c_done_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const order = orders[id];
    if (order) {
        stats.totalSum += order.total;
        order.items.forEach(i => stats.items[i.name] = (stats.items[i.name] || 0) + 1);
        courierStats[ctx.from.id] = (courierStats[ctx.from.id] || 0) + 1;
        bot.telegram.sendMessage(order.userId, `🏁 Buyurtmangiz yetkazildi. 👋`);
        bot.telegram.sendMessage(ADMIN_ID, `✅ #${id} topshirildi! Jami: ${stats.totalSum.toLocaleString()} so'm.`);
        ctx.editMessageText(`🏁 #${id} yakunlandi. Bugun jami: ${courierStats[ctx.from.id]} ta`);
        delete orders[id];
    }
});

bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    let t = `📊 *Hisobot:*\n💰 Jami: ${stats.totalSum.toLocaleString()} so'm\n`;
    for(let k in stats.items) t += `🔹 ${k}: ${stats.items[k]} ta\n`;
    ctx.replyWithMarkdown(t);
});

bot.hears('🏁 Topshirilgan buyurtmalarim', (ctx) => ctx.reply(`✅ Bugun jami: ${courierStats[ctx.from.id] || 0} ta`));
bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("O'tildi:", mainKeyboard));
bot.action('clear_cart', (ctx) => { carts[ctx.from.id] = []; ctx.editMessageText("Tozalandi."); });

bot.launch();
