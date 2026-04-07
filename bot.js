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

// --- ADMINGA BUYURTMA YUBORISH (HAMMA TUGMALAR VA ASLIY MATNLAR BILAN) ---
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    if (!order) return;
    
    let itemsText = "";
    order.items.forEach((item, index) => {
        itemsText += `${index + 1}. ${item.name} — ${item.price.toLocaleString()} so'm\n`;
    });
    
    let payTypeText = order.payType === 'karta' ? "💳 Karta orqali (Chek kutilmoqda)" : "💵 Naqd pul (Kuryerga)";
    
    let messageToAdmin = `🆕 *YANGI BUYURTMA #${orderId}*\n\n` +
                         `💰 To'lov turi: ${payTypeText}\n` +
                         `📞 Telefon: +${order.phone}\n` +
                         `💰 Jami summa: ${order.total.toLocaleString()} so'm\n\n` +
                         `📋 *Buyurtma tarkibi:*\n${itemsText}`;

    await bot.telegram.sendMessage(ADMIN_ID, messageToAdmin, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback("🚚 Shahriyor", `ch_${orderId}_6382827314`),
                Markup.button.callback("🚚 Ali", `ch_${orderId}_222222222`)
            ],
            [Markup.button.callback("👨‍🍳 Tayyorlashni boshlash", `lock_${orderId}`)],
            [Markup.button.callback("❌ Buyurtmani rad etish", `rej_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugab qolgan", `out_list_${orderId}`)],
            [Markup.button.callback("⏳ Buyurtma ko'p (Mijozni ogohlantirish)", `busy_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// 2. KLAVIATURALAR (TO'LIQ)
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
    ['📊 Kunlik hisobot', '📦 Faol buyurtmalar'],
    ['🗑 Taomni o\'chirish', '🏠 Mijoz menyusiga o\'tish']
]).resize();

bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) ctx.reply("Assalomu alaykum Admin! Kerakli bo'limni tanlang: 🛠", adminKeyboard);
    else ctx.reply("Coffee Food botiga xush kelibsiz! Marhamat, menyudan taom tanlang: 👋", mainKeyboard);
});

// --- ADMIN: TAOM QO'SHISH ---
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'name' };
    ctx.reply("Yangi taom nomini kiriting:");
});

bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = adminState[userId];
    if (!state || userId !== ADMIN_ID) return next();
    if (state.step === 'name') {
        state.name = ctx.message.text;
        state.step = 'price';
        ctx.reply(`${state.name} uchun narxni kiriting:`);
    } else if (state.step === 'price') {
        const price = parseInt(ctx.message.text);
        menu.push({ id: 'm' + Date.now(), name: state.name, price: price });
        delete adminState[userId];
        ctx.reply("✅ Qo'shildi!", adminKeyboard);
    }
});

// --- MIJOZ LOGIKASI ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name} - ${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("🍴 Taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 1 }));
});

bot.action(/add_(.+)/, async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    const item = menu.find(i => i.id === ctx.match[1]);
    carts[userId].push({ ...item });
    await ctx.answerCbQuery(`${item.name} qo'shildi! ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (cart.length === 0) return ctx.reply("Sizning savatchangiz bo'sh! 🛒");
    let total = cart.reduce((a, b) => a + b.price, 0);
    ctx.replyWithMarkdown(`💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

bot.action('order_start', (ctx) => {
    ctx.reply("📞 Telefon raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Telefon raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) users[userId] = {};
    users[userId].phone = ctx.message.contact.phone_number;
    ctx.reply("📍 Lokatsiyangizni yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

bot.on('location', (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) users[userId] = {};
    users[userId].lat = ctx.message.location.latitude;
    users[userId].lon = ctx.message.location.longitude;
    ctx.reply("💳 To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd (Kuryerga)", "pay_cash")],
        [Markup.button.callback("💳 Karta orqali", "pay_card")]
    ]));
});

// --- TO'LOV: NAQD ---
bot.action('pay_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.answerCbQuery("Savatchangiz bo'sh!");
    const orderId = (orderCounter++).toString();
    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude: users[userId].lat, longitude: users[userId].lon, 
        items: [...cart], total: cart.reduce((a,b)=>a+b.price,0), status: 'Yangi', payType: 'naqd' 
    };
    await ctx.editMessageText(`✅ Buyurtmangiz #${orderId} qabul qilindi.`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// --- TO'LOV: KARTA (FIXED - HAR DOIM ISHLAYDIGAN VARIANT) ---
bot.action('pay_card', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (cart.length === 0) return ctx.answerCbQuery("Savatchangiz bo'sh!");

    const total = cart.reduce((a, b) => a + b.price, 0);
    // Ma'lumotlarni o'chib ketmasligi uchun saqlab qo'yamiz
    users[userId].pendingOrder = { items: [...cart], total: total };

    let paymentMsg = `💳 *To'lov ma'lumotlari:*\n\n🔢 Karta: \`${KARTA_RAQAM}\`\n👤 Egasi: ${KARTA_E_ISM}\n💰 Summa: *${total.toLocaleString()} so'm*\n\n"✅ To'ladim" tugmasini bosing:`;
    await ctx.editMessageText(paymentMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("✅ To'ladim", "confirm_card")]])
    });
});

bot.action('confirm_card', async (ctx) => {
    const userId = ctx.from.id;
    // AGAR USERS O'CHIB KETGAN BO'LSA HAM, BOT TO'XTAB QOLMAYDI
    if (!users[userId] || !users[userId].phone) {
        return ctx.answerCbQuery("⚠️ Xato! Iltimos, raqam va lokatsiyani qaytadan yuboring.", { show_alert: true });
    }

    const pending = users[userId].pendingOrder || { items: carts[userId], total: (carts[userId]?.reduce((a,b)=>a+b.price,0) || 0) };

    if (!pending.items || pending.items.length === 0) {
        return ctx.answerCbQuery("⚠️ Savatchangiz topilmadi!", { show_alert: true });
    }

    const orderId = (orderCounter++).toString();
    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude: users[userId].lat, longitude: users[userId].lon, 
        items: pending.items, total: pending.total, status: 'Karta (Kutilmoqda)', payType: 'karta' 
    };

    await ctx.editMessageText(`📌 Buyurtma #${orderId} yuborildi! Chekni ${ADMIN_USERNAME} ga yuboring.`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[userId] = []; 
    delete users[userId].pendingOrder;
});

// --- ADMIN ACTIONLARI (ORIGINAL) ---
bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const [_, id, cId] = ctx.match;
    if (orders[id]) {
        const courier = COURIERS.find(c => c.id == cId);
        orders[id].status = `Kuryerga (${courier.name}) berildi`;
        bot.telegram.sendMessage(cId, `📦 Buyurtma #${id} keldi!`);
        ctx.editMessageText(`✅ #${id} ${courier.name}ga biriktirildi.`);
    }
});

bot.action(/lock_(.+)/, (ctx) => {
    const id = ctx.match[1];
    bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtmangiz (#${id}) tayyorlanmoqda!`);
    ctx.answerCbQuery("Tayyorlanmoqda...");
});

bot.action(/rej_(.+)/, (ctx) => {
    const id = ctx.match[1];
    bot.telegram.sendMessage(orders[id].userId, "❌ Uzr, buyurtmangiz rad etildi.");
    delete orders[id]; ctx.editMessageText(`❌ #${id} rad etildi.`);
});

bot.action(/busy_(.+)/, (ctx) => {
    bot.telegram.sendMessage(orders[ctx.match[1]].userId, `⏳ Buyurtmalar ko'p, biroz kechikish bo'lishi mumkin. 😊`);
    ctx.answerCbQuery("Ogohlantirildi!");
});

// --- LAUNCH ---
bot.telegram.deleteWebhook().then(() => bot.launch());
