const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// --- ASOSIY MA'LUMOTLAR ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 8448862547; 
const ADMIN_USERNAME = "@username"; 
const KARTA_RAQAM = "8600 0000 0000 0000"; 
const KARTA_E_ISM = "Falonchi Pistonchiyev"; 

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let carts = {};
let orders = {};
let users = {}; 

// --- ADMINGA BUYURTMA YUBORISH (SENING UZUN TUGMALARING BILAN) ---
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    
    let itemsText = "";
    order.items.forEach((item, index) => {
        itemsText += `${index + 1}. ${item.name} — ${item.price.toLocaleString()} so'm\n`;
    });
    
    let payTypeText = "";
    if (order.payType === 'karta') {
        payTypeText = "💳 Karta orqali (Chek kutilmoqda)";
    } else {
        payTypeText = "💵 Naqd pul (Kuryerga)";
    }
    
    let messageToAdmin = `🆕 *YANGI BUYURTMA #${orderId}*\n\n` +
                         `💰 To'lov turi: ${payTypeText}\n` +
                         `📞 Telefon: +${order.phone}\n` +
                         `💰 Jami summa: ${order.total.toLocaleString()} so'm\n\n` +
                         `📋 *Buyurtma tarkibi:*\n${itemsText}`;

    await bot.telegram.sendMessage(ADMIN_ID, messageToAdmin, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🚚 Shahriyor", callback_data: `ch_${orderId}_6382827314` },
                    { text: "🚚 Ali", callback_data: `ch_${orderId}_222222222` }
                ],
                [{ text: "👨‍🍳 Tayyorlashni boshlash", callback_data: `lock_${orderId}` }],
                [{ text: "❌ Buyurtmani rad etish", callback_data: `rej_${orderId}` }],
                [{ text: "⚠️ Mahsulotlarimiz orasidan tugab qolganini bildirish", callback_data: `out_list_${orderId}` }],
                [{ text: "⏳ Buyurtma ko'p (Mijozni ogohlantirish)", callback_data: `busy_${orderId}` }]
            ]
        }
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// --- ASOSIY KLAVIATURA ---
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

bot.start((ctx) => {
    ctx.reply("Coffee Food botiga xush kelibsiz! Marhamat, menyudan taom tanlang: 👋", mainKeyboard);
});

// --- MENYU QISMI (SEN YOZGANDEK DONALAB) ---
bot.hears('🍴 Menyu', (ctx) => {
    ctx.reply("🍴 Bizning menyu bilan tanishing va taom tanlang:", Markup.inlineKeyboard([
        [{ text: "🍔 Burger - 30,000 so'm", callback_data: "add_burger" }],
        [{ text: "🍔 Burger dvaynoy - 35,000 so'm", callback_data: "add_dvaynoy" }],
        [{ text: "🍔 Burger troynoy - 40,000 so'm", callback_data: "add_troynoy" }],
        [{ text: "🌯 Lavash - 32,000 so'm", callback_data: "add_lavash" }]
    ]));
});

bot.action("add_burger", async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId]) { carts[userId] = []; }
    carts[userId].push({ name: "🍔 Burger", price: 30000 });
    await ctx.answerCbQuery("🍔 Burger savatchaga qo'shildi! ✅");
});

bot.action("add_dvaynoy", async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId]) { carts[userId] = []; }
    carts[userId].push({ name: "🍔 Burger dvaynoy", price: 35000 });
    await ctx.answerCbQuery("🍔 Burger dvaynoy savatchaga qo'shildi! ✅");
});

bot.action("add_lavash", async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId]) { carts[userId] = []; }
    carts[userId].push({ name: "🌯 Lavash", price: 32000 });
    await ctx.answerCbQuery("🌯 Lavash savatchaga qo'shildi! ✅");
});

// --- SAVATCHA ---
bot.hears('🛒 Savatcha', (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (cart.length === 0) {
        return ctx.reply("Sizning savatchangiz hozircha bo'sh! 🛒");
    }
    
    let total = 0;
    let text = "🛒 *Sizning savatchangizda:*\n\n";
    for (let i = 0; i < cart.length; i++) {
        text = text + (i + 1) + ". " + cart[i].name + " — " + cart[i].price.toLocaleString() + " so'm\n";
        total = total + cart[i].price;
    }
    
    ctx.replyWithMarkdown(text + "\n💰 *Jami:* " + total.toLocaleString() + " so'm", Markup.inlineKeyboard([
        [{ text: "✅ Buyurtma berishni davom ettirish", callback_data: "order_start" }],
        [{ text: "🗑 Savatchani tozalash", callback_data: "clear_cart" }]
    ]));
});

// --- BUYURTMA BERISH BOSHQICHMA-BOSHQICH ---
bot.action('order_start', (ctx) => {
    ctx.reply("📞 Buyurtmani rasmiylashtirish uchun telefon raqamingizni yuboring:", Markup.keyboard([
        [Markup.button.contactRequest("📞 Telefon raqamni yuborish")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) { users[userId] = {}; }
    users[userId].phone = ctx.message.contact.phone_number;
    ctx.reply("📍 Rahmat! Endi buyurtmangizni yetkazishimiz uchun lokatsiyangizni yuboring:", Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiyani yuborish")]
    ]).resize().oneTime());
});

bot.on('location', (ctx) => {
    const userId = ctx.from.id;
    users[userId].lat = ctx.message.location.latitude;
    users[userId].lon = ctx.message.location.longitude;
    ctx.reply("💳 Iltimos, to'lov turini tanlang:", Markup.inlineKeyboard([
        [{ text: "💵 Naqd pul (Kuryerga)", callback_data: "pay_cash" }],
        [{ text: "💳 Karta orqali to'lov", callback_data: "pay_card" }]
    ]));
});

// --- TO'LOV TURLARI ---
bot.action('pay_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    let total = 0;
    for (let i = 0; i < cart.length; i++) { total += cart[i].price; }

    const orderId = (orderCounter++).toString();
    orders[orderId] = { 
        userId: userId, phone: users[userId].phone, latitude: users[userId].lat, longitude: users[userId].lon, 
        items: [...cart], total: total, payType: 'naqd' 
    };

    await ctx.editMessageText("✅ Buyurtmangiz #" + orderId + " qabul qilindi. Tez orada bog'lanamiz!");
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.action('pay_card', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    let total = 0;
    for (let i = 0; i < cart.length; i++) { total += cart[i].price; }

    // SHU YERDA MA'LUMOTNI SAQLAB QOLAMIZ (XATO BERMASLIGI UCHUN)
    users[userId].pendingOrder = { items: [...cart], total: total };

    let paymentMsg = "💳 *To'lov ma'lumotlari:*\n\n" +
                     "🔢 Karta raqami: `" + KARTA_RAQAM + "`\n" +
                     "👤 Karta egasi: " + KARTA_E_ISM + "\n" +
                     "💰 To'lov summasi: *" + total.toLocaleString() + " so'm*\n\n" +
                     "Iltimos, pulni o'tkazgandan so'ng quyidagi \"✅ To'ladim\" tugmasini bosing.";

    await ctx.editMessageText(paymentMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: "✅ To'ladim", callback_data: "confirm_card" }]]
        }
    });
});

bot.action('confirm_card', async (ctx) => {
    const userId = ctx.from.id;
    const userData = users[userId];
    
    if (!userData || !userData.pendingOrder) {
        return ctx.answerCbQuery("⚠️ Ma'lumot topilmadi!");
    }

    const orderId = (orderCounter++).toString();
    orders[orderId] = { 
        userId: userId, phone: userData.phone, latitude: userData.lat, longitude: userData.lon, 
        items: userData.pendingOrder.items, total: userData.pendingOrder.total, payType: 'karta' 
    };

    await ctx.editMessageText("📌 Rahmat! Buyurtmangiz #" + orderId + " adminga yuborildi. To'lov chekini " + ADMIN_USERNAME + " ga yuboring.", mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[userId] = []; 
    delete userData.pendingOrder;
});

bot.launch();
