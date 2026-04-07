const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 8448862547; 
const ADMIN_USERNAME = "@shakhriyar"; // ADMIN USERNAME (Lichkasi)
const KARTA_RAQAM = "8600 0000 0000 0000"; // KARTA RAQAMI
const KARTA_E_ISM = "Falonchi Pistonchiyev"; // KARTA EGASI

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
let users = {}; // Mijoz ma'lumotlarini saqlash uchun

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

// Kuryer tayinlash logikasi
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
        if (isNaN(price)) return ctx.reply("Iltimos faqat raqam yozing:");
        menu.push({ id: 'm' + Date.now(), name: state.name, price });
        delete adminState[userId];
        ctx.reply("✅ Qo'shildi!", adminKeyboard);
    } else if (state.step === 'new_price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply("Iltimos faqat raqam yozing:");
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
    users[userId].lat = ctx.message.location.latitude;
    users[userId].lon = ctx.message.location.longitude;

    ctx.reply("💳 To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd (Kuryerga)", "pay_method_cash")],
        [Markup.button.callback("💳 Karta orqali", "pay_method_card")]
    ]));
});

// NAQD TO'LOV
bot.action('pay_method_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.answerCbQuery("Savatchangiz bo'sh!");

    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = { 
        userId, 
        phone: users[userId].phone, 
        latitude: users[userId].lat, 
        longitude: users[userId].lon, 
        items: [...cart], 
        total, 
        status: 'Yangi', 
        lockCancel: false, 
        payType: 'naqd' 
    };

    await ctx.editMessageText(`✅ Buyurtma #${orderId} qabul qilindi (Naqd).`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// KARTA ORQALI TO'LOV
bot.action('pay_method_card', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.answerCbQuery("Savatchangiz bo'sh!");

    const total = cart.reduce((a, b) => a + b.price, 0);
    
    let msg = `💳 *To'lov ma'lumotlari:*\n\n`;
    msg += `🔢 Karta: \`${KARTA_RAQAM}\`\n`;
    msg += `👤 Egasi: ${KARTA_E_ISM}\n`;
    msg += `💰 Summa: *${total.toLocaleString()} so'm*\n\n`;
    msg += `Pulni o'tkazib, "✅ To'ladim" tugmasini bosing.`;

    await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("✅ To'ladim", "confirm_card_payment")]])
    });
});

// TO'LADIM TUGMASI
bot.action('confirm_card_payment', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    
    if (!cart.length) {
        return ctx.answerCbQuery("Xatolik! Savatcha topilmadi.");
    }

    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = { 
        userId, 
        phone: users[userId].phone, 
        latitude: users[userId].lat, 
        longitude: users[userId].lon, 
        items: [...cart], 
        total, 
        status: 'Yangi (Karta)', 
        lockCancel: false, 
        payType: 'karta' 
    };

    const adminMsg = `📌 Iltimos, to'lov chekini adminga yuboring: ${ADMIN_USERNAME}\n\nBuyurtmangiz #${orderId} adminga yuborildi.`;
    
    await ctx.editMessageText(adminMsg);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// --- QOLGAN FUNKSIYALAR ---
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

bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].lockCancel = true;
        orders[id].status = 'Tayyorlanmoqda';
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtma #${id} tayyorlanmoqda! Uni endi bekor qila olmaysiz. 🔒`);
        ctx.answerCbQuery("Tayyorlanmoqda...");
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].status = 'Yo\'lda 🚚';
        await bot.telegram.sendMessage(orders[id].userId, `🚀 *Buyurtmangiz yo'lda!*`);
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

bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    let t = `📊 *Hisobot:*\n💰 Jami: ${stats.totalSum.toLocaleString()} so'm\n`;
    for(let k in stats.items) t += `🔹 ${k}: ${stats.items[k]} ta\n`;
    ctx.replyWithMarkdown(t);
});

bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("O'tildi:", mainKeyboard));
bot.action('clear_cart', (ctx) => { carts[ctx.from.id] = []; ctx.editMessageText("Tozalandi."); });

// --- XATONI OLDINI OLISH (Conflict fix) ---
bot.telegram.deleteWebhook().then(() => {
    bot.launch();
    console.log("Bot ideal holatda ishga tushdi!");
});
