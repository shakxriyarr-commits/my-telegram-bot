const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 8448862547; 
const ADMIN_USERNAME = "@username"; 
const KARTA_RAQAM = "8600 0000 0000 0000"; 
const KARTA_E_ISM = "Falonchi Pistonchiyev"; 

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let stats = { totalSum: 0, items: {} }; 
let courierStats = {}; 
let adminState = {}; 

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
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

// --- ADMINGA BUYURTMA YUBORISH (HAMMA TUGMALARI BILAN) ---
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    if (!order) return;
    let itemsText = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    let payTypeText = order.payType === 'karta' ? "💳 Karta (Chek kutilmoqda)" : "💵 Naqd";
    
    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n💰 To'lov turi: ${payTypeText}\n\n📋 *Tarkibi:*\n${itemsText}\n\n📞 Tel: +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback("🚚 Shahriyor", `ch_${orderId}_6382827314`),
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

// --- START ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) ctx.reply("Admin panel! 🛠", adminKeyboard);
    else if (COURIERS.some(c => c.id === userId)) ctx.reply("Kuryer paneli! 🚗", courierKeyboard);
    else ctx.reply("Coffee Food botiga xush kelibsiz! 👋", mainKeyboard);
});

// --- ADMIN PANELI (QISQARMAGAN) ---
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
    if (idx !== -1) { menu.splice(idx, 1); ctx.editMessageText("✅ O'chirildi."); }
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
        if (isNaN(price)) return ctx.reply("Raqam yozing:");
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
    const userId = ctx.from.id;
    const id = ctx.match[1];
    const item = menu.find(i => i.id === id);
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
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

bot.action('order_start', (ctx) => {
    ctx.reply("📞 Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiyangizni yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) users[userId] = {};
    users[userId].tempLat = ctx.message.location.latitude;
    users[userId].tempLon = ctx.message.location.longitude;

    ctx.reply("💳 To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd (Kuryerga)", "pay_cash_process")],
        [Markup.button.callback("💳 Karta orqali", "pay_card_process")]
    ]));
});

// --- TO'LOV JARAYONI (NAQD) ---
bot.action('pay_cash_process', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.answerCbQuery("Savatchangiz bo'sh!");

    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude: users[userId].tempLat, longitude: users[userId].tempLon, 
        items: [...cart], total, status: 'Yangi', lockCancel: false, payType: 'naqd' 
    };

    await ctx.editMessageText(`✅ Buyurtma #${orderId} qabul qilindi. To'lov turi: Naqd.`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// --- TO'LOV JARAYONI (KARTA - MUAMMO SHU YERDA EDI, TO'G'RILANDI) ---
bot.action('pay_card_process', async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId] || carts[userId].length === 0) {
        return ctx.answerCbQuery("Xato: Savatcha bo'sh!");
    }
    
    const total = carts[userId].reduce((a, b) => a + b.price, 0);
    let msg = `💳 *To'lov ma'lumotlari:*\n\n🔢 Karta: \`${KARTA_RAQAM}\`\n👤 Egasi: ${KARTA_E_ISM}\n💰 Summa: *${total.toLocaleString()} so'm*\n\n"✅ To'ladim" tugmasini bosing.`;

    await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("✅ To'ladim", "confirm_card_pay")]])
    });
});

bot.action('confirm_card_pay', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];

    // SAVATCHA TEKSHIRUVI
    if (!cart || cart.length === 0) {
        return ctx.answerCbQuery("⚠️ Savatcha ma'lumotlari yo'qolgan! Qaytadan urinib ko'ring.", { show_alert: true });
    }

    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude: users[userId].tempLat, longitude: users[userId].tempLon, 
        items: [...cart], total, status: 'Karta (Chek kutilmoqda)', lockCancel: false, payType: 'karta' 
    };

    await ctx.editMessageText(`📌 Chekni adminga yuboring: ${ADMIN_USERNAME}\n\nBuyurtmangiz #${orderId} yuborildi.`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    
    // BUYURTMA BITGANDAN KEYIN SAVATCHANI TOZALASH
    carts[userId] = []; 
});

// --- ADMIN VA KURYER ACTIONLARI (TO'LIQ) ---
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

bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].lockCancel = true;
        orders[id].status = 'Tayyorlanmoqda';
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtma #${id} tayyorlanmoqda! Uni bekor qila olmaysiz. 🔒`);
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].status = 'Yo\'lda 🚚';
        await bot.telegram.sendMessage(orders[id].userId, `🚀 Buyurtmangiz yo'lda!`);
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

bot.action(/rej_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, "❌ Buyurtmangiz rad etildi.");
        delete orders[id]; ctx.editMessageText(`❌ #${id} rad etildi.`);
    }
});

bot.action(/busy_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        await bot.telegram.sendMessage(orders[id].userId, `⏳ Bandlik sababli buyurtma biroz kechikishi mumkin. 😊`);
        await ctx.answerCbQuery("Ogohlantirildi!");
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
        bot.telegram.sendMessage(order.userId, `⚠️ Uzr, *${item.name}* tugagan ekan. Buyurtma yangilandi.`);
        ctx.editMessageText("Mijozga xabar yuborildi.");
    }
});

bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const my = Object.keys(orders).filter(id => orders[id].userId === ctx.from.id);
    if (!my.length) return ctx.reply("Faol buyurtmalar yo'q.");
    my.forEach(id => {
        const o = orders[id];
        ctx.replyWithMarkdown(`📦 *#${id}*\n💰 ${o.total.toLocaleString()} so'm\n📊 *${o.status}*`);
    });
});

bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    let t = `📊 *Hisobot:*\n💰 Jami: ${stats.totalSum.toLocaleString()} so'm\n`;
    for(let k in stats.items) t += `🔹 ${k}: ${stats.items[k]} ta\n`;
    ctx.replyWithMarkdown(t);
});

bot.hears('🏁 Topshirilgan buyurtmalarim', (ctx) => ctx.reply(`✅ Bugun jami: ${courierStats[ctx.from.id] || 0} ta`));
bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz menyusi:", mainKeyboard));
bot.action('clear_cart', (ctx) => { carts[ctx.from.id] = []; ctx.editMessageText("Tozalandi."); });

// --- LAUNCH ---
bot.telegram.deleteWebhook().then(() => {
    bot.launch();
    console.log("Bot ideal holatda ishga tushdi!");
});
