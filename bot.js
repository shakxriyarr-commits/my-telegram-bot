const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ==========================================
// 1. ASOSIY KONFIGURATSIYA
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

// MA'LUMOTLAR OMBORI
let orderCounter = 1; 
let carts = {};
let orders = {};
let users = {}; 

// ==========================================
// 2. ADMINGA BUYURTMA YUBORISH (SENING UZUN TUGMALARING)
// ==========================================
async function sendOrderToAdmin(orderId) {
    let order = orders[orderId];
    
    let itemsText = "";
    // Bittalab qo'shib chiqamiz (Qisqartirmasdan)
    if (order.items[0]) { itemsText = itemsText + "1. " + order.items[0].name + " — " + order.items[0].price + " so'm\n"; }
    if (order.items[1]) { itemsText = itemsText + "2. " + order.items[1].name + " — " + order.items[1].price + " so'm\n"; }
    if (order.items[2]) { itemsText = itemsText + "3. " + order.items[2].name + " — " + order.items[2].price + " so'm\n"; }
    if (order.items[3]) { itemsText = itemsText + "4. " + order.items[3].name + " — " + order.items[3].price + " so'm\n"; }
    if (order.items[4]) { itemsText = itemsText + "5. " + order.items[4].name + " — " + order.items[4].price + " so'm\n"; }
    
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
    messageToAdmin = messageToAdmin + "💰 Jami summa: " + order.total + " so'm\n\n";
    messageToAdmin = messageToAdmin + "📋 *Buyurtma tarkibi:*\n" + itemsText;

    await bot.telegram.sendMessage(ADMIN_ID, messageToAdmin, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🚚 Shahriyor", callback_data: "ch_" + orderId + "_6382827314" },
                    { text: "🚚 Ali", callback_data: "ch_" + orderId + "_222222222" }
                ],
                [{ text: "👨‍🍳 Tayyorlashni boshlash", callback_data: "lock_" + orderId }],
                [{ text: "❌ Buyurtmani rad etish", callback_data: "rej_" + orderId }],
                [{ text: "⚠️ Mahsulotlarimiz orasidan tugab qolganini bildirish", callback_data: "out_list_" + orderId }],
                [{ text: "⏳ Buyurtma ko'p (Mijozni ogohlantirish)", callback_data: "busy_" + orderId }]
            ]
        }
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// ==========================================
// 3. ASOSIY KLAVIATURA VA START
// ==========================================
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

bot.start((ctx) => {
    ctx.reply("Coffee Food botiga xush kelibsiz! 👋", mainKeyboard);
});

// ==========================================
// 4. MENYU (HAR BIR TAOM ALOHIDA-ALOHIDA)
// ==========================================
bot.hears('🍴 Menyu', (ctx) => {
    ctx.reply("🍴 Taom tanlang:", Markup.inlineKeyboard([
        [{ text: "🍔 Burger - 30,000", callback_data: "add_burger" }],
        [{ text: "🍔 Burger dvaynoy - 35,000", callback_data: "add_dvaynoy" }],
        [{ text: "🍔 Burger troynoy - 40,000", callback_data: "add_troynoy" }],
        [{ text: "🌯 Lavash - 32,000", callback_data: "add_lavash" }],
        [{ text: "🌯 Lavash mini - 25,000", callback_data: "add_lavash_mini" }],
        [{ text: "🍟 Free - 15,000", callback_data: "add_free" }],
        [{ text: "🥤 Coca-Cola - 8,000", callback_data: "add_cola" }]
    ]));
});

// HAR BIR TAOMNI ALOHIDA YOZAMIZ (QISQARTIRMASDAN)
bot.action("add_burger", async (ctx) => {
    let uid = ctx.from.id;
    if (!carts[uid]) { carts[uid] = []; }
    carts[uid].push({ name: "🍔 Burger", price: 30000 });
    await ctx.answerCbQuery("🍔 Burger qo'shildi!");
});

bot.action("add_dvaynoy", async (ctx) => {
    let uid = ctx.from.id;
    if (!carts[uid]) { carts[uid] = []; }
    carts[uid].push({ name: "🍔 Burger dvaynoy", price: 35000 });
    await ctx.answerCbQuery("🍔 Burger dvaynoy qo'shildi!");
});

bot.action("add_lavash", async (ctx) => {
    let uid = ctx.from.id;
    if (!carts[uid]) { carts[uid] = []; }
    carts[uid].push({ name: "🌯 Lavash", price: 32000 });
    await ctx.answerCbQuery("🌯 Lavash qo'shildi!");
});

bot.action("add_cola", async (ctx) => {
    let uid = ctx.from.id;
    if (!carts[uid]) { carts[uid] = []; }
    carts[uid].push({ name: "🥤 Coca-Cola", price: 8000 });
    await ctx.answerCbQuery("🥤 Coca-Cola qo'shildi!");
});

// ==========================================
// 5. SAVATCHA (HAR BIR QATORNI ALOHIDA YOZAMIZ)
// ==========================================
bot.hears('🛒 Savatcha', (ctx) => {
    let uid = ctx.from.id;
    let cart = carts[uid] || [];
    
    if (cart.length === 0) {
        return ctx.reply("Sizning savatchangiz bo'sh! 🛒");
    }
    
    let total = 0;
    let text = "🛒 *Sizning savatchangiz:*\n\n";
    
    if (cart[0]) { text = text + "1. " + cart[0].name + " - " + cart[0].price + "\n"; total = total + cart[0].price; }
    if (cart[1]) { text = text + "2. " + cart[1].name + " - " + cart[1].price + "\n"; total = total + cart[1].price; }
    if (cart[2]) { text = text + "3. " + cart[2].name + " - " + cart[2].price + "\n"; total = total + cart[2].price; }
    if (cart[3]) { text = text + "4. " + cart[3].name + " - " + cart[3].price + "\n"; total = total + cart[3].price; }
    if (cart[4]) { text = text + "5. " + cart[4].name + " - " + cart[4].price + "\n"; total = total + cart[4].price; }
    
    ctx.replyWithMarkdown(text + "\n💰 Jami: " + total + " so'm", Markup.inlineKeyboard([
        [{ text: "✅ Buyurtma berish", callback_data: "order_start" }],
        [{ text: "🗑 Tozalash", callback_data: "clear_cart" }]
    ]));
});

// ==========================================
// 6. BUYURTMA BERISH (BOSHQIChMA-BOSHQICh)
// ==========================================
bot.action('order_start', (ctx) => {
    ctx.reply("📞 Telefon raqamingizni yuboring:", Markup.keyboard([
        [Markup.button.contactRequest("📞 Telefon raqamni yuborish")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    let uid = ctx.from.id;
    if (!users[uid]) { users[uid] = {}; }
    users[uid].phone = ctx.message.contact.phone_number;
    ctx.reply("📍 Lokatsiyangizni yuboring:", Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiyani yuborish")]
    ]).resize().oneTime());
});

bot.on('location', (ctx) => {
    let uid = ctx.from.id;
    if (!users[uid]) { users[uid] = {}; }
    users[uid].lat = ctx.message.location.latitude;
    users[uid].lon = ctx.message.location.longitude;
    ctx.reply("💳 To'lov turini tanlang:", Markup.inlineKeyboard([
        [{ text: "💵 Naqd pul", callback_data: "pay_cash" }],
        [{ text: "💳 Karta orqali", callback_data: "pay_card" }]
    ]));
});

// ==========================================
// 7. TO'LOV: KARTA VA "TO'LADIM" TUGMASI
// ==========================================
bot.action('pay_card', async (ctx) => {
    let uid = ctx.from.id;
    let cart = carts[uid] || [];
    let total = 0;
    if (cart[0]) total = total + cart[0].price;
    if (cart[1]) total = total + cart[1].price;
    if (cart[2]) total = total + cart[2].price;
    if (cart[3]) total = total + cart[3].price;
    if (cart[4]) total = total + cart[4].price;

    // SAQLAB QOLISH (BU QISM ISHLAYDI)
    if (!users[uid]) { users[uid] = {}; }
    users[uid].pendingOrder = { 
        items: [...cart], 
        total: total 
    };

    let pMsg = "💳 *To'lov ma'lumotlari:*\n\n" +
              "🔢 Karta: `" + KARTA_RAQAM + "`\n" +
              "👤 Egasi: " + KARTA_E_ISM + "\n" +
              "💰 Summa: *" + total + " so'm*\n\n" +
              "To'lovdan so'ng tugmani bosing.";

    await ctx.editMessageText(pMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: "✅ To'ladim", callback_data: "confirm_card" }]]
        }
    });
});

bot.action('confirm_card', async (ctx) => {
    let uid = ctx.from.id;
    let uData = users[uid];
    
    if (!uData || !uData.pendingOrder) {
        return ctx.answerCbQuery("⚠️ Xato!");
    }

    let orderId = (orderCounter++).toString();
    orders[orderId] = { 
        userId: uid, 
        phone: uData.phone, 
        latitude: uData.lat, 
        longitude: uData.lon, 
        items: uData.pendingOrder.items, 
        total: uData.pendingOrder.total, 
        payType: 'karta' 
    };

    await ctx.editMessageText("📌 Rahmat! Buyurtmangiz #" + orderId + " adminga yuborildi.", mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[uid] = []; 
    delete users[uid].pendingOrder;
});

bot.action('pay_cash', async (ctx) => {
    let uid = ctx.from.id;
    let cart = carts[uid] || [];
    let total = 0;
    if (cart[0]) total = total + cart[0].price;
    if (cart[1]) total = total + cart[1].price;
    
    let orderId = (orderCounter++).toString();
    orders[orderId] = { 
        userId: uid, phone: users[uid].phone, latitude: users[uid].lat, longitude: users[uid].lon, 
        items: [...cart], total: total, payType: 'naqd' 
    };

    await ctx.editMessageText("✅ Buyurtma #" + orderId + " qabul qilindi!");
    await sendOrderToAdmin(orderId);
    carts[uid] = [];
});

bot.launch();
