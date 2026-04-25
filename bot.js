const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 8030496668; 
const ADMIN_USERNAME = "@username"; // BU YERGA O'ZINGIZNI USERNAMEINGIZNI YOZING
const KARTA_RAQAM = "8600 0000 0000 0000"; // KARTA RAQAMINGIZ
const KARTA_EGASI = "Falonchi Pistonchiyev"; // ISMINGIZ

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let stats = { totalSum: 0, items: {} }; 
let courierStats = {}; 
let adminState = {}; 

const COURIERS = [
    { id: 7312694067, name: "Shahriyor" },
    { id: 222222222, name: "Ali" }
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
    let payTypeText = (order.payType === 'karta') ? "💳 Karta (To'lov ma'lumotlari berildi)" : "💵 Naqd pul";

    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n\n💰 To'lov: ${payTypeText}\n📋 *Tarkibi:*\n${itemsText}\n\n📞 Tel: +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback("🚚 Shahriyor", `ch_${orderId}_7312694067`),
                Markup.button.callback("🚚 Ali", `ch_${orderId}_222222222`)
            ],
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `rej_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)],
            [Markup.button.callback("⏳ Buyurtma ko'p (Ogohlantirish)", `busy_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// Saytdan kelgan kuryer tugmalarini tutish
bot.action(/courier_(sh|al)/, async (ctx) => {
    const type = ctx.match[1];
    const courierName = type === 'sh' ? "Shahriyor" : "Ali";
    const courierId = type === 'sh' ? 6382827314 : 222222222; 
    const originalText = ctx.callbackQuery.message.text;

    try {
        await bot.telegram.sendMessage(courierId, `🚴‍♂️ **Sizga yangi buyurtma biriktirildi!**\n\n${originalText}`, { parse_mode: 'Markdown' });
        await ctx.editMessageText(`${originalText}\n\n✅ **${courierName}ga yuborildi!**`);
        await ctx.answerCbQuery(`${courierName}ga yuborildi!`);
    } catch (err) {
        await ctx.answerCbQuery("Xatolik! Kuryer botni yoqmagan bo'lishi mumkin.");
    }
});

bot.action("rej_order", (ctx) => {
    ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n❌ **Buyurtma rad etildi.**");
});

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
    ctx.reply("Tahrirlash uchun tanlang:", Markup.inlineKeyboard(buttons));
});

bot.hears('🗑 Taomni o\'chirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(`🗑 ${i.name}`, `del_i_${i.id}`)]);
    ctx.reply("O'chirish uchun taomni tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/edit_p_(.+)/, (ctx) => {
    adminState[ctx.from.id] = { step: 'new_price', itemId: ctx.match[1] };
    ctx.reply("Yangi narxni yozing:");
});

bot.action(/del_i_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const idx = menu.findIndex(i => i.id === id);
    if (idx !== -1) {
        menu.splice(idx, 1);
        ctx.editMessageText("✅ O'chirildi.");
    }
});

bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = adminState[userId];
    if (!state || userId !== ADMIN_ID) return next();
    if (state.step === 'name') {
        state.name = ctx.message.text;
        state.step = 'price';
        ctx.reply(`${state.name} narxi:`);
    } else if (state.step === 'price') {
        const price = parseInt(ctx.message.text);
        menu.push({ id: 'm' + Date.now(), name: state.name, price });
        delete adminState[userId];
        ctx.reply("✅ Qo'shildi!", adminKeyboard);
    } else if (state.step === 'new_price') {
        const price = parseInt(ctx.message.text);
        const item = menu.find(i => i.id === state.itemId);
        if (item) item.price = price;
        delete adminState[userId];
        ctx.reply("✅ Yangilandi!", adminKeyboard);
    }
});

// --- MIJOZ LOGIKASI ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name}\n${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
});

bot.action(/add_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const item = menu.find(i => i.id === id);
    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push({ ...item });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatcha bo'sh 🛒");
    let total = 0;
    let text = "🛒 *Savatchangizda:*\n\n";
    cart.forEach((i, idx) => {
        text += `${idx+1}. ${i.name} — ${i.price.toLocaleString()} so'm\n`;
        total += i.price;
    });
    ctx.replyWithMarkdown(`${text}\n💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
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
    
    users[userId].latitude = ctx.message.location.latitude;
    users[userId].longitude = ctx.message.location.longitude;

    ctx.reply("💳 To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd pul", "pay_cash")],
        [Markup.button.callback("💳 Karta orqali", "pay_card")]
    ]));
});

// --- TO'LOV VA MENYUGA QAYTARISH ---
bot.action('pay_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return;

    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);
    
    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude: users[userId].latitude, longitude: users[userId].longitude, 
        items: [...cart], total, payType: 'naqd', status: 'Yangi', lockCancel: false 
    };

    await ctx.deleteMessage();
    await ctx.reply(`✅ Buyurtma #${orderId} qabul qilindi. Kuryerga naqd to'laysiz.`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});
bot.action('pay_card', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return;

    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude: users[userId].latitude, longitude: users[userId].longitude, 
        items: [...cart], total, payType: 'karta', status: 'Yangi', lockCancel: false 
    };

    let payMsg = `✅ *Buyurtma #${orderId} qabul qilindi!*\n\n`;
    payMsg += `💳 *To'lov ma'lumotlari:*\n`;
    payMsg += `🔢 Karta: \`${KARTA_RAQAM}\`\n`;
    payMsg += `👤 Egasi: ${KARTA_EGASI}\n`;
    payMsg += `💰 Summa: *${total.toLocaleString()} so'm*\n\n`;
    // SHU YERDA O'ZGARISH:
    payMsg += `⚠️ To'lovni qilgach, to'lov chekini *#${orderId}-buyurtma* deb adminga yuboring: ${ADMIN_USERNAME}`;

    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(payMsg, mainKeyboard);
    
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const my = Object.keys(orders).filter(id => orders[id].userId === ctx.from.id);
    if (!my.length) return ctx.reply("Faol buyurtmalar yo'q.");
    my.forEach(id => {
        const o = orders[id];
        let text = `📦 *#${id}*\n📋 ${o.items.map(i=>i.name).join(', ')}\n💰 ${o.total.toLocaleString()} so'm\n📊 *${o.status}*`;
        const btn = !o.lockCancel ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${id}`)]]) : null;
        ctx.replyWithMarkdown(text, btn);
    });
});

// --- ADMIN & KURYER ACTIONLARI (ORIGINAL) ---
bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].lockCancel = true;
        orders[id].status = 'Tayyorlanmoqda';
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtma #${id} tayyorlanmoqda! Uni endi bekor qila olmaysiz. 🔒`);
        ctx.answerCbQuery("Tayyorlanmoqda...");
    }
});

bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const [_, id, cId] = ctx.match;
    const order = orders[id];
    if (order) {
        order.status = 'Kuryerga berildi';
        let itemsList = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
        bot.telegram.sendMessage(cId, `📦 *BUYURTMA #${id}*\n\n📋 *Mahsulotlar:*\n${itemsList}\n\n📞 Tel: +${order.phone}\n💰 Summa: ${order.total.toLocaleString()} so'm`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `c_take_${id}`)],
                [Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]
            ])
        });
        bot.telegram.sendLocation(cId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ #${id} kuryerga yuborildi.`);
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const order = orders[id];
    if (order) {
        order.status = 'Yo\'lda 🚚';
        await bot.telegram.sendMessage(order.userId, `🚀 *Buyurtmangiz yo'lda!* \nKuryer buyurtmangizni qabul qildi va yo'lga chiqdi. 🚚`);
        await ctx.answerCbQuery("Mijozga xabar yuborildi! ✅");
        await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([[Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]]).reply_markup);
    }
});

bot.action(/c_done_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const o = orders[id];
    if (o) {
        stats.totalSum += o.total;
        o.items.forEach(i => stats.items[i.name] = (stats.items[i.name] || 0) + 1);
        courierStats[ctx.from.id] = (courierStats[ctx.from.id] || 0) + 1;
        bot.telegram.sendMessage(o.userId, `🏁 Buyurtmangiz yetkazildi! 👋`);
        bot.telegram.sendMessage(ADMIN_ID, `✅ #${id} topshirildi!`);
        ctx.editMessageText(`🏁 Yakunlandi.`);
        delete orders[id];
    }
});

bot.action(/busy_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        await bot.telegram.sendMessage(orders[id].userId, `⏳ *Hurmatli mijoz!* \nHozirda buyurtmalar juda ko'p bo'lgani sababli, tayyorlash biroz ko'proq vaqt olishi mumkin. Tushunganingiz uchun rahmat! 😊`, { parse_mode: 'Markdown' });
        await ctx.answerCbQuery("Mijoz ogohlantirildi! ✅");
    }
});

bot.action(/out_list_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        const btns = orders[id].items.map((it, idx) => [Markup.button.callback(`❌ ${it.name} tugagan`, `c_out_${id}_${idx}`)]);
        ctx.editMessageText("Tugagan mahsulotni tanlang:", Markup.inlineKeyboard(btns));
    }
});

bot.action(/c_out_(.+)_(.+)/, async (ctx) => {
    const [_, id, idx] = ctx.match;
    const order = orders[id];
    if (order) {
        const item = order.items[idx];
        order.items.splice(idx, 1);
        order.total -= item.price;
        if (order.items.length > 0) {
            await bot.telegram.sendMessage(order.userId, `⚠️ Uzr, *${item.name}* tugagan ekan.\nQolganlari yuborilsinmi?`, Markup.inlineKeyboard([
                [Markup.button.callback("✅ Ha", `u_y_${id}`)], [Markup.button.callback("❌ Yo'q", `u_n_${id}`)]
            ]));
            ctx.editMessageText(`✅ Mijozga so'rov yuborildi.`);
        } else {
            bot.telegram.sendMessage(order.userId, "⚠️ Mahsulot tugagani uchun buyurtma bekor qilindi.");
            delete orders[id]; ctx.editMessageText("Bekor qilindi.");
        }
    }
});

bot.action(/u_y_(.+)/, (ctx) => { ctx.editMessageText("✅ Yangilandi!"); sendOrderToAdmin(ctx.match[1]); });
bot.action(/u_n_(.+)/, (ctx) => { 
    const id = ctx.match[1];
    delete orders[id]; 
    ctx.editMessageText("🚫 Bekor qilindi."); 
    bot.telegram.sendMessage(ADMIN_ID, `❌ Mijoz #${id} rad etdi.`); 
});

bot.action(/u_cn_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id] && !orders[id].lockCancel) {
        await bot.telegram.sendMessage(ADMIN_ID, `⚠️ *BUYURTMA BEKOR QILINDI (#${id})*\nMijoz bekor qildi.`);
        delete orders[id]; ctx.editMessageText("🚫 Bekor qilindi.");
    } else ctx.answerCbQuery("Bekor qilib bo'lmaydi!", { show_alert: true });
});

bot.action(/rej_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, "❌ Buyurtmangiz rad etildi.");
        delete orders[id]; ctx.editMessageText(`❌ #${id} rad etildi.`);
    }
});

// --- HISOBOT VA BOSHQA ---
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
