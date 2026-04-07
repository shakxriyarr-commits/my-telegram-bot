const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ==========================================
// 1. ASOSIY KONFIGURATSIYA VA O'ZGARUVCHILAR
// ==========================================
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 8448862547; 
const ADMIN_USERNAME = "@username"; 
const KARTA_RAQAM = "8600 0000 0000 0000"; 
const KARTA_E_ISM = "Falonchi Pistonchiyev"; 

const app = express();
app.get('/', (req, res) => {
    res.send('Bot is running!');
});
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let carts = {};
let orders = {};
let users = {}; 

// ==========================================
// 2. ADMINGA BUYURTMA YUBORISH FUNKSIYASI
// ==========================================
async function sendOrderToAdmin(orderId) {
    let order = orders[orderId];
    
    let itemsText = "";
    // Har bir mahsulotni bittalab matnga qo'shamiz
    let i = 0;
    while (i < order.items.length) {
        let item = order.items[i];
        itemsText = itemsText + (i + 1) + ". " + item.name + " — " + item.price.toLocaleString() + " so'm\n";
        i = i + 1;
    }
    
    let payTypeText = "";
    if (order.payType === 'karta') {
        payTypeText = "💳 Karta orqali (Chek kutilmoqda)";
    } else {
        payTypeText = "💵 Naqd pul (Kuryerga)";
    }
    
    let messageToAdmin = "";
    messageToAdmin = messageToAdmin + "🆕 *YANGI BUYURTMA #" + orderId + "*\n\n";
    messageToAdmin = messageToAdmin + "💰 To'lov turi: " + payTypeText + "\n";
    messageToAdmin = messageToAdmin + "📞 Telefon: +" + order.phone + "\n";
    messageToAdmin = messageToAdmin + "💰 Jami summa: " + order.total.toLocaleString() + " so'm\n\n";
    messageToAdmin = messageToAdmin + "📋 *Buyurtma tarkibi:*\n" + itemsText;

    let adminButtons = [
        [
            { text: "🚚 Shahriyor", callback_data: "ch_" + orderId + "_6382827314" },
            { text: "🚚 Ali", callback_data: "ch_" + orderId + "_222222222" }
        ],
        [
            { text: "👨‍🍳 Tayyorlashni boshlash", callback_data: "lock_" + orderId }
        ],
        [
            { text: "❌ Buyurtmani rad etish", callback_data: "rej_" + orderId }
        ],
        [
            { text: "⚠️ Mahsulotlarimiz orasidan tugab qolganini bildirish", callback_data: "out_list_" + orderId }
        ],
        [
            { text: "⏳ Buyurtma ko'p (Mijozni ogohlantirish)", callback_data: "busy_" + orderId }
        ]
    ];

    await bot.telegram.sendMessage(ADMIN_ID, messageToAdmin, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: adminButtons
        }
    });
    
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// ==========================================
// 3. ASOSIY KLAVIATURALAR
// ==========================================
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

// ==========================================
// 4. BOT BUYRUQLARI VA KOMANDALARI
// ==========================================
bot.start((ctx) => {
    let startText = "Coffee Food botiga xush kelibsiz! 👋\n";
    startText = startText + "Marhamat, quyidagi menyudan foydalanib taom tanlang.";
    ctx.reply(startText, mainKeyboard);
});

// ==========================================
// 5. MENYU QISMI (HAR BIR TAOM ALOHIDA)
// ==========================================
bot.hears('🍴 Menyu', (ctx) => {
    let menuText = "🍴 Bizning menyu bilan tanishing va taom tanlang:";
    let menuButtons = [
        [{ text: "🍔 Burger - 30,000 so'm", callback_data: "add_burger" }],
        [{ text: "🍔 Burger dvaynoy - 35,000 so'm", callback_data: "add_dvaynoy" }],
        [{ text: "🍔 Burger troynoy - 40,000 so'm", callback_data: "add_troynoy" }],
        [{ text: "🌯 Lavash - 32,000 so'm", callback_data: "add_lavash" }],
        [{ text: "🌯 Lavash mini - 25,000 so'm", callback_data: "add_lavash_mini" }],
        [{ text: "🍟 Free - 15,000 so'm", callback_data: "add_free" }],
        [{ text: "🥤 Coca-Cola 0.5 - 8,000 so'm", callback_data: "add_cola" }]
    ];
    
    ctx.reply(menuText, Markup.inlineKeyboard(menuButtons));
});

// --- TAOM QO'SHISH ACTIONLARI ---

bot.action("add_burger", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let item = { name: "🍔 Burger", price: 30000 };
    carts[userId].push(item);
    await ctx.answerCbQuery("🍔 Burger savatchaga qo'shildi! ✅");
});

bot.action("add_dvaynoy", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let item = { name: "🍔 Burger dvaynoy", price: 35000 };
    carts[userId].push(item);
    await ctx.answerCbQuery("🍔 Burger dvaynoy savatchaga qo'shildi! ✅");
});

bot.action("add_troynoy", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let item = { name: "🍔 Burger troynoy", price: 40000 };
    carts[userId].push(item);
    await ctx.answerCbQuery("🍔 Burger troynoy savatchaga qo'shildi! ✅");
});

bot.action("add_lavash", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let item = { name: "🌯 Lavash", price: 32000 };
    carts[userId].push(item);
    await ctx.answerCbQuery("🌯 Lavash savatchaga qo'shildi! ✅");
});

bot.action("add_lavash_mini", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let item = { name: "🌯 Lavash mini", price: 25000 };
    carts[userId].push(item);
    await ctx.answerCbQuery("🌯 Lavash mini savatchaga qo'shildi! ✅");
});

bot.action("add_free", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let item = { name: "🍟 Free", price: 15000 };
    carts[userId].push(item);
    await ctx.answerCbQuery("🍟 Free savatchaga qo'shildi! ✅");
});

bot.action("add_cola", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let item = { name: "🥤 Coca-Cola 0.5", price: 8000 };
    carts[userId].push(item);
    await ctx.answerCbQuery("🥤 Coca-Cola savatchaga qo'shildi! ✅");
});

// ==========================================
// 6. SAVATCHA VA BUYURTMA RASMIYLASHTIRISH
// ==========================================
bot.hears('🛒 Savatcha', (ctx) => {
    let userId = ctx.from.id;
    let cart = carts[userId];
    
    if (!cart || cart.length === 0) {
        let emptyText = "Sizning savatchangiz hozircha bo'sh! 🛒\n";
        emptyText = emptyText + "Marhamat, menyudan taom tanlang.";
        return ctx.reply(emptyText);
    }
    
    let total = 0;
    let text = "🛒 *Sizning savatchangizda:*\n\n";
    
    let k = 0;
    while (k < cart.length) {
        let p = cart[k];
        text = text + (k + 1) + ". " + p.name + " — " + p.price.toLocaleString() + " so'm\n";
        total = total + p.price;
        k = k + 1;
    }
    
    let cartButtons = [
        [{ text: "✅ Buyurtma berishni davom ettirish", callback_data: "order_start" }],
        [{ text: "🗑 Savatchani tozalash", callback_data: "clear_cart" }]
    ];
    
    ctx.replyWithMarkdown(text + "\n💰 *Jami:* " + total.toLocaleString() + " so'm", Markup.inlineKeyboard(cartButtons));
});

bot.action('clear_cart', (ctx) => {
    let userId = ctx.from.id;
    carts[userId] = [];
    ctx.editMessageText("Savatchangiz muvaffaqiyatli tozalandi! 🗑");
});

// --- BUYURTMA BOSHQICHMA-BOSHQICH ---
bot.action('order_start', (ctx) => {
    let contactText = "📞 Buyurtmani rasmiylashtirish uchun telefon raqamingizni yuboring:\n";
    contactText = contactText + "(Tugmani bosib yuboring)";
    ctx.reply(contactText, Markup.keyboard([
        [Markup.button.contactRequest("📞 Telefon raqamni yuborish")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    let userId = ctx.from.id;
    if (!users[userId]) {
        users[userId] = {};
    }
    users[userId].phone = ctx.message.contact.phone_number;
    
    let locationText = "📍 Rahmat! Endi buyurtmangizni yetkazishimiz uchun lokatsiyangizni yuboring:\n";
    locationText = locationText + "(Tugmani bosib yuboring)";
    
    ctx.reply(locationText, Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiyani yuborish")]
    ]).resize().oneTime());
});

bot.on('location', (ctx) => {
    let userId = ctx.from.id;
    if (!users[userId]) {
        users[userId] = {};
    }
    users[userId].lat = ctx.message.location.latitude;
    users[userId].lon = ctx.message.location.longitude;
    
    let payText = "💳 Iltimos, to'lov turini tanlang:\n";
    payText = payText + "O'zingizga qulay usulni tanlang.";
    
    ctx.reply(payText, Markup.inlineKeyboard([
        [{ text: "💵 Naqd pul (Kuryerga)", callback_data: "pay_cash" }],
        [{ text: "💳 Karta orqali to'lov", callback_data: "pay_card" }]
    ]));
});

// ==========================================
// 7. TO'LOV VA FINAL
// ==========================================

bot.action('pay_cash', async (ctx) => {
    let userId = ctx.from.id;
    let cart = carts[userId];
    
    let total = 0;
    let m = 0;
    while (m < cart.length) {
        total = total + cart[m].price;
        m = m + 1;
    }

    let orderId = (orderCounter++).toString();
    
    orders[orderId] = { 
        userId: userId, 
        phone: users[userId].phone, 
        latitude: users[userId].lat, 
        longitude: users[userId].lon, 
        items: [...cart], 
        total: total, 
        payType: 'naqd' 
    };

    let finishText = "✅ Rahmat! Buyurtmangiz #" + orderId + " qabul qilindi.\n";
    finishText = finishText + "Tez orada operatorimiz siz bilan bog'lanadi!";

    await ctx.editMessageText(finishText);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.action('pay_card', async (ctx) => {
    let userId = ctx.from.id;
    let cart = carts[userId];
    
    let total = 0;
    let n = 0;
    while (n < cart.length) {
        total = total + cart[n].price;
        n = n + 1;
    }

    // MA'LUMOTLARNI SAQLASH
    if (!users[userId]) {
        users[userId] = {};
    }
    users[userId].pendingOrder = { 
        items: [...cart], 
        total: total 
    };

    let paymentMsg = "";
    paymentMsg = paymentMsg + "💳 *To'lov ma'lumotlari:*\n\n";
    paymentMsg = paymentMsg + "🔢 Karta raqami: `" + KARTA_RAQAM + "`\n";
    paymentMsg = paymentMsg + "👤 Karta egasi: " + KARTA_E_ISM + "\n";
    paymentMsg = paymentMsg + "💰 To'lov summasi: *" + total.toLocaleString() + " so'm*\n\n";
    paymentMsg = paymentMsg + "Iltimos, pulni o'tkazgandan so'ng quyidagi \"✅ To'ladim\" tugmasini bosing va chekni adminga yuboring.";

    await ctx.editMessageText(paymentMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ To'ladim", callback_data: "confirm_card" }]
            ]
        }
    });
});

bot.action('confirm_card', async (ctx) => {
    let userId = ctx.from.id;
    let userData = users[userId];
    
    if (!userData || !userData.pendingOrder) {
        return ctx.answerCbQuery("⚠️ Xato! Savatcha ma'lumotlari topilmadi.");
    }

    let orderId = (orderCounter++).toString();
    
    orders[orderId] = { 
        userId: userId, 
        phone: userData.phone, 
        latitude: userData.lat, 
        longitude: userData.lon, 
        items: userData.pendingOrder.items, 
        total: userData.pendingOrder.total, 
        payType: 'karta' 
    };

    let resultText = "";
    resultText = resultText + "📌 Rahmat! Buyurtmangiz #" + orderId + " adminga yuborildi.\n\n";
    resultText = resultText + "To'lov chekini ushbu profilga yuboring: " + ADMIN_USERNAME + "\n";
    resultText = resultText + "Siz bilan tez orada bog'lanamiz!";

    await ctx.editMessageText(resultText, mainKeyboard);
    await sendOrderToAdmin(orderId);
    
    carts[userId] = []; 
    delete userData.pendingOrder;
});

// ==========================================
// 8. BOTNI ISHGA TUSHIRISH
// ==========================================
bot.launch();
console.log("Bot 400 qator atrofida muvaffaqiyatli ishga tushdi!");
