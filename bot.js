const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ==========================================
// 1. ASOSIY SOZLAMALAR VA KONFIGURATSIYA
// ==========================================
const token = process.env.BOT_TOKEN; 
const bot = new Telegraf(token);

const ADMIN_ID = 8448862547; 
const ADMIN_USERNAME = "@username"; 
const KARTA_RAQAM = "8600 0000 0000 0000"; 
const KARTA_E_ISM = "Falonchi Pistonchiyev"; 

const app = express();
app.get('/', (req, res) => {
    res.send('Coffee Food Bot Server is Running Perfectly!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server portda ishga tushdi: " + PORT);
});

// ==========================================
// 2. MA'LUMOTLAR OMBORI (GLOBAL O'ZGARUVCHILAR)
// ==========================================
let orderCounter = 1; 
let carts = {};
let orders = {};
let users = {}; 

// ==========================================
// 3. ADMINGA BUYURTMA YUBORISH (HAR BIR QATOR ALOHIDA)
// ==========================================
async function sendOrderToAdmin(orderId) {
    let currentOrder = orders[orderId];
    
    if (!currentOrder) {
        return;
    }

    let itemsDescription = "";
    let counter = 1;

    // Har bir mahsulotni bittalab tekshirib chiqamiz (Sening uslubing)
    if (currentOrder.items[0]) {
        itemsDescription = itemsDescription + counter + ". " + currentOrder.items[0].name + " — " + currentOrder.items[0].price + " so'm\n";
        counter = counter + 1;
    }
    if (currentOrder.items[1]) {
        itemsDescription = itemsDescription + counter + ". " + currentOrder.items[1].name + " — " + currentOrder.items[1].price + " so'm\n";
        counter = counter + 1;
    }
    if (currentOrder.items[2]) {
        itemsDescription = itemsDescription + counter + ". " + currentOrder.items[2].name + " — " + currentOrder.items[2].price + " so'm\n";
        counter = counter + 1;
    }
    if (currentOrder.items[3]) {
        itemsDescription = itemsDescription + counter + ". " + currentOrder.items[3].name + " — " + currentOrder.items[3].price + " so'm\n";
        counter = counter + 1;
    }
    if (currentOrder.items[4]) {
        itemsDescription = itemsDescription + counter + ". " + currentOrder.items[4].name + " — " + currentOrder.items[4].price + " so'm\n";
        counter = counter + 1;
    }
    if (currentOrder.items[5]) {
        itemsDescription = itemsDescription + counter + ". " + currentOrder.items[5].name + " — " + currentOrder.items[5].price + " so'm\n";
        counter = counter + 1;
    }

    let finalPayType = "";
    if (currentOrder.payType === 'karta') {
        finalPayType = "💳 Karta orqali (To'lov cheki kutilmoqda)";
    } else {
        finalPayType = "💵 Naqd pul (Kuryerga to'lanadi)";
    }

    let adminMsg = "";
    adminMsg = adminMsg + "🔔 *YANGI BUYURTMA QABUL QILINDI*\n\n";
    adminMsg = adminMsg + "🆔 Buyurtma raqami: #" + orderId + "\n";
    adminMsg = adminMsg + "💰 To'lov usuli: " + finalPayType + "\n";
    adminMsg = adminMsg + "📞 Mijoz telefoni: +" + currentOrder.phone + "\n";
    adminMsg = adminMsg + "💵 Jami summa: " + currentOrder.total + " so'm\n\n";
    adminMsg = adminMsg + "📝 *Buyurtma tarkibi:*\n" + itemsDescription;

    let adminKeyboard = [
        [
            { text: "🚚 Shahriyorga biriktirish", callback_data: "ch_" + orderId + "_6382827314" },
            { text: "🚚 Aliga biriktirish", callback_data: "ch_" + orderId + "_222222222" }
        ],
        [{ text: "👨‍🍳 Tayyorlashni boshlash", callback_data: "lock_" + orderId }],
        [{ text: "❌ Buyurtmani rad etish", callback_data: "rej_" + orderId }],
        [{ text: "⚠️ Mahsulot tugaganini bildirish", callback_data: "out_list_" + orderId }],
        [{ text: "⏳ Mijozni kutishga ogohlantirish", callback_data: "busy_" + orderId }]
    ];

    await bot.telegram.sendMessage(ADMIN_ID, adminMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: adminKeyboard
        }
    });

    await bot.telegram.sendLocation(ADMIN_ID, currentOrder.latitude, currentOrder.longitude);
}

// ==========================================
// 4. ASOSIY START VA KLAVIATURALAR
// ==========================================
const mainButtons = [
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
];

const mainKeyboard = Markup.keyboard(mainButtons).resize();

bot.start((ctx) => {
    let welcomeText = "Coffee Food botiga xush kelibsiz! 👋\n\n";
    welcomeText = welcomeText + "Bizda eng mazali taomlar va tezkor yetkazib berish xizmati mavjud.";
    ctx.reply(welcomeText, mainKeyboard);
});

// ==========================================
// 5. MENYU VA TAOM QO'SHISH (DONALAB YOZILGAN)
// ==========================================
bot.hears('🍴 Menyu', (ctx) => {
    let menuText = "🍴 Marhamat, o'zingizga yoqqan taomni tanlang:";
    
    let menuInline = [
        [{ text: "🍔 Burger - 30,000 so'm", callback_data: "add_burger" }],
        [{ text: "🍔 Burger dvaynoy - 35,000 so'm", callback_data: "add_dvaynoy" }],
        [{ text: "🌯 Lavash - 32,000 so'm", callback_data: "add_lavash" }],
        [{ text: "🌯 Lavash mini - 25,000 so'm", callback_data: "add_lavash_mini" }],
        [{ text: "🍟 Free - 15,000 so'm", callback_data: "add_free" }],
        [{ text: "🥤 Coca-Cola - 8,000 so'm", callback_data: "add_cola" }]
    ];

    ctx.reply(menuText, Markup.inlineKeyboard(menuInline));
});

bot.action("add_burger", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let burgerItem = { name: "🍔 Burger", price: 30000 };
    carts[userId].push(burgerItem);
    await ctx.answerCbQuery("🍔 Burger savatchaga qo'shildi!");
});

bot.action("add_dvaynoy", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let dvaynoyItem = { name: "🍔 Burger dvaynoy", price: 35000 };
    carts[userId].push(dvaynoyItem);
    await ctx.answerCbQuery("🍔 Burger dvaynoy savatchaga qo'shildi!");
});

bot.action("add_lavash", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let lavashItem = { name: "🌯 Lavash", price: 32000 };
    carts[userId].push(lavashItem);
    await ctx.answerCbQuery("🌯 Lavash savatchaga qo'shildi!");
});

bot.action("add_cola", async (ctx) => {
    let userId = ctx.from.id;
    if (!carts[userId]) {
        carts[userId] = [];
    }
    let colaItem = { name: "🥤 Coca-Cola", price: 8000 };
    carts[userId].push(colaItem);
    await ctx.answerCbQuery("🥤 Coca-Cola savatchaga qo'shildi!");
});

// ==========================================
// 6. SAVATCHA BILAN ISHLASH
// ==========================================
bot.hears('🛒 Savatcha', (ctx) => {
    let userId = ctx.from.id;
    let userCart = carts[userId];

    if (!userCart || userCart.length === 0) {
        let emptyCartMsg = "Sizning savatchangiz hozircha bo'sh! 🛒\n";
        emptyCartMsg = emptyCartMsg + "Iltimos, avval menyudan taom tanlang.";
        return ctx.reply(emptyCartMsg);
    }

    let cartTotalSum = 0;
    let cartListText = "🛒 *Siz tanlagan mahsulotlar:*\n\n";

    if (userCart[0]) { cartListText += "1. " + userCart[0].name + " - " + userCart[0].price + " so'm\n"; cartTotalSum += userCart[0].price; }
    if (userCart[1]) { cartListText += "2. " + userCart[1].name + " - " + userCart[1].price + " so'm\n"; cartTotalSum += userCart[1].price; }
    if (userCart[2]) { cartListText += "3. " + userCart[2].name + " - " + userCart[2].price + " so'm\n"; cartTotalSum += userCart[2].price; }
    if (userCart[3]) { cartListText += "4. " + userCart[3].name + " - " + userCart[3].price + " so'm\n"; cartTotalSum += userCart[3].price; }
    if (userCart[4]) { cartListText += "5. " + userCart[4].name + " - " + userCart[4].price + " so'm\n"; cartTotalSum += userCart[4].price; }

    let cartActionButtons = [
        [{ text: "✅ Buyurtmani rasmiylashtirish", callback_data: "order_start" }],
        [{ text: "🗑 Savatchani butunlay tozalash", callback_data: "clear_cart" }]
    ];

    ctx.replyWithMarkdown(cartListText + "\n💰 *Jami summa:* " + cartTotalSum + " so'm", Markup.inlineKeyboard(cartActionButtons));
});

bot.action('clear_cart', (ctx) => {
    let userId = ctx.from.id;
    carts[userId] = [];
    ctx.editMessageText("Savatchangiz muvaffaqiyatli tozalandi! 🗑");
});

// ==========================================
// 7. BUYURTMA BOSHQICHLARI (UZUN YO'L)
// ==========================================
bot.action('order_start', (ctx) => {
    let askPhoneText = "📞 Buyurtmani davom ettirish uchun telefon raqamingizni yuboring:";
    ctx.reply(askPhoneText, Markup.keyboard([
        [Markup.button.contactRequest("📞 Telefon raqamni yuborish")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    let userId = ctx.from.id;
    if (!users[userId]) {
        users[userId] = {};
    }
    users[userId].phone = ctx.message.contact.phone_number;

    let askLocationText = "📍 Rahmat! Endi bizga taomni qayerga yetkazish kerakligini ko'rsating (Lokatsiya yuboring):";
    ctx.reply(askLocationText, Markup.keyboard([
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

    let askPayMethodText = "💳 To'lov turini tanlang. Sizga qaysi biri qulay?";
    let payButtons = [
        [{ text: "💵 Naqd pul (Kuryerga)", callback_data: "pay_cash" }],
        [{ text: "💳 Karta orqali to'lov", callback_data: "pay_card" }]
    ];

    ctx.reply(askPayMethodText, Markup.inlineKeyboard(payButtons));
});

// ==========================================
// 8. TO'LOV VA "TO'LADIM" (ISHLOVCHI QISM)
// ==========================================
bot.action('pay_card', async (ctx) => {
    let userId = ctx.from.id;
    let userCart = carts[userId];

    if (!userCart || userCart.length === 0) {
        return ctx.answerCbQuery("Savatchangiz bo'sh qolibdi!");
    }

    let finalTotal = 0;
    if (userCart[0]) finalTotal += userCart[0].price;
    if (userCart[1]) finalTotal += userCart[1].price;
    if (userCart[2]) finalTotal += userCart[2].price;
    if (userCart[3]) finalTotal += userCart[3].price;
    if (userCart[4]) finalTotal += userCart[4].price;

    // MA'LUMOTLARNI SAQLASH (TO'LADIM UCHUN)
    if (!users[userId]) {
        users[userId] = {};
    }
    users[userId].pendingOrderData = {
        items: [...userCart],
        total: finalTotal
    };

    let cardPaymentMsg = "";
    cardPaymentMsg += "💳 *TO'LOV MA'LUMOTLARI:*\n\n";
    cardPaymentMsg += "🔢 Karta raqamimiz: `" + KARTA_RAQAM + "`\n";
    cardPaymentMsg += "👤 Karta egasi: " + KARTA_E_ISM + "\n";
    cardPaymentMsg += "💰 To'lov summasi: *" + finalTotal + " so'm*\n\n";
    cardPaymentMsg += "Iltimos, to'lovni amalga oshirgach, quyidagi \"✅ To'ladim\" tugmasini bosing.";

    let confirmButton = [
        [{ text: "✅ To'ladim", callback_data: "confirm_card" }]
    ];

    await ctx.editMessageText(cardPaymentMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: confirmButton
        }
    });
});

bot.action('confirm_card', async (ctx) => {
    let userId = ctx.from.id;
    let userData = users[userId];

    if (!userData || !userData.pendingOrderData) {
        return ctx.answerCbQuery("⚠️ Ma'lumot eskirgan. Iltimos, savatchadan qaytadan boshlang!", { show_alert: true });
    }

    let orderId = (orderCounter++).toString();

    orders[orderId] = {
        userId: userId,
        phone: userData.phone,
        latitude: userData.lat,
        longitude: userData.lon,
        items: userData.pendingOrderData.items,
        total: userData.pendingOrderData.total,
        payType: 'karta'
    };

    let successMsg = "📌 Rahmat! Buyurtmangiz #" + orderId + " muvaffaqiyatli qabul qilindi.\n\n";
    successMsg += "To'lov chekini ushbu profilga yuboring: " + ADMIN_USERNAME + "\n";
    successMsg += "Tez orada kuryerimiz siz bilan bog'lanadi.";

    await ctx.editMessageText(successMsg, mainKeyboard);
    await sendOrderToAdmin(orderId);

    // ENDI TOZALAYMIZ
    carts[userId] = [];
    delete userData.pendingOrderData;
});

bot.action('pay_cash', async (ctx) => {
    let userId = ctx.from.id;
    let userCart = carts[userId];

    let cashTotal = 0;
    if (userCart[0]) cashTotal += userCart[0].price;
    if (userCart[1]) cashTotal += userCart[1].price;
    if (userCart[2]) cashTotal += userCart[2].price;

    let orderId = (orderCounter++).toString();

    orders[orderId] = {
        userId: userId,
        phone: users[userId].phone,
        latitude: users[userId].lat,
        longitude: users[userId].lon,
        items: [...userCart],
        total: cashTotal,
        payType: 'naqd'
    };

    await ctx.editMessageText("✅ Buyurtmangiz #" + orderId + " qabul qilindi! Kuryer pulni yetkazib berishda oladi.");
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// ==========================================
// 9. BOTNI ISHGA TUSHIRISH
// ==========================================
bot.launch().then(() => {
    console.log("Coffee Food Bot 400 qatorda gursillab ishlamoqda!");
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
