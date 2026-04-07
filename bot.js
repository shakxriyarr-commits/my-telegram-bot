const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ==========================================
// 1. SOZLAMALAR (HECH NARSA QISQARMADI)
// ==========================================
const bot = new Telegraf("TOKENNI_SHU_YERGA_QO'Y"); 
const ADMIN_ID = 8448862547; 
const ADMIN_USERNAME = "@username"; 
const KARTA_RAQAM = "8600 0000 0000 0000"; 
const KARTA_E_ISM = "Falonchi Pistonchiyev"; 

const app = express();
app.get('/', (req, res) => { res.send('Bot ishlayapti!'); });
app.listen(process.env.PORT || 3000);

// MA'LUMOTLAR OMBORI
let orderCounter = 1; 
let carts = {};
let orders = {};
let users = {}; 

// ==========================================
// 2. ADMINGA YUBORISH (SENING UZUN TUGMALARING)
// ==========================================
async function sendOrderToAdmin(orderId) {
    let order = orders[orderId];
    if (!order) return;

    let itemsText = "";
    // Har bir mahsulotni bittalab qo'shish (Sening uslubingda)
    if (order.items[0]) { itemsText += "1. " + order.items[0].name + " — " + order.items[0].price + " so'm\n"; }
    if (order.items[1]) { itemsText += "2. " + order.items[1].name + " — " + order.items[1].price + " so'm\n"; }
    if (order.items[2]) { itemsText += "3. " + order.items[2].name + " — " + order.items[2].price + " so'm\n"; }
    if (order.items[3]) { itemsText += "4. " + order.items[3].name + " — " + order.items[3].price + " so'm\n"; }
    if (order.items[4]) { itemsText += "5. " + order.items[4].name + " — " + order.items[4].price + " so'm\n"; }
    
    let payTypeText = "";
    if (order.payType === 'karta') {
        payTypeText = "💳 Karta (To'lov qilindi, chekni so'rang)";
    } else {
        payTypeText = "💵 Naqd pul (Kuryerga)";
    }
    
    let messageToAdmin = "🆕 *YANGI BUYURTMA #" + orderId + "*\n\n" +
                         "💰 To'lov turi: " + payTypeText + "\n" +
                         "📞 Telefon: +" + order.phone + "\n" +
                         "💰 Jami summa: " + order.total + " so'm\n\n" +
                         "📋 *Buyurtma tarkibi:*\n" + itemsText;

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
// 3. ASOSIY KLAVIATURA
// ==========================================
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

bot.start((ctx) => {
    ctx.reply("Coffee Food botiga xush kelibsiz! 👋", mainKeyboard);
});

// ==========================================
// 4. MENYU (HAR BIR TAOM ALOHIDA)
// ==========================================
bot.hears('🍴 Menyu', (ctx) => {
    ctx.reply("🍴 Taom tanlang:", Markup.inlineKeyboard([
        [{ text: "🍔 Burger - 30,000", callback_data: "add_burger" }],
        [{ text: "🍔 Burger dvaynoy - 35,000", callback_data: "add_dvaynoy" }],
        [{ text: "🌯 Lavash - 32,000", callback_data: "add_lavash" }],
        [{ text: "🥤 Coca-Cola - 8,000", callback_data: "add_cola" }]
    ]));
});

bot.action("add_burger", async (ctx) => {
    let uid = ctx.from.id;
    if (!carts[uid]) carts[uid] = [];
    carts[uid].push({ name: "🍔 Burger", price: 30000 });
    await ctx.answerCbQuery("🍔 Burger qo'shildi!");
});

bot.action("add_dvaynoy", async (ctx) => {
    let uid = ctx.from.id;
    if (!carts[uid]) carts[uid] = [];
    carts[uid].push({ name: "🍔 Burger dvaynoy", price: 35000 });
    await ctx.answerCbQuery("🍔 Burger dvaynoy qo'shildi!");
});

bot.action("add_lavash", async (ctx) => {
    let uid = ctx.from.id;
    if (!carts[uid]) carts[uid] = [];
    carts[uid].push({ name: "🌯 Lavash", price: 32000 });
    await ctx.answerCbQuery("🌯 Lavash qo'shildi!");
});

// ==========================================
// 5. SAVATCHA
// ==========================================
bot.hears('🛒 Savatcha', (ctx) => {
    let uid = ctx.from.id;
    let cart = carts[uid] || [];
    if (cart.length === 0) return ctx.reply("Savatcha bo'sh! 🛒");
    
    let total = 0;
    let text = "🛒 *Savatchangiz:*\n\n";
    for (let i = 0; i < cart.length; i++) {
        text += (i + 1) + ". " + cart[i].name + " - " + cart[i].price + " so'm\n";
        total += cart[i].price;
    }
    
    ctx.replyWithMarkdown(text + "\n💰 Jami: " + total + " so'm", Markup.inlineKeyboard([
        [{ text: "✅ Buyurtma berish", callback_data: "order_start" }],
        [{ text: "🗑 Tozalash", callback_data: "clear_cart" }]
    ]));
});

bot.action('order_start', (ctx) => {
    ctx.reply("📞 Telefon yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Telefon yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    let uid = ctx.from.id;
    if (!users[uid]) users[uid] = {};
    users[uid].phone = ctx.message.contact.phone_number;
    ctx.reply("📍 Lokatsiya yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya yuborish")]]).resize().oneTime());
});

bot.on('location', (ctx) => {
    let uid = ctx.from.id;
    if (!users[uid]) users[uid] = {};
    users[uid].lat = ctx.message.location.latitude;
    users[uid].lon = ctx.message.location.longitude;
    ctx.reply("💳 To'lov turi:", Markup.inlineKeyboard([
        [{ text: "💵 Naqd pul", callback_data: "pay_cash" }],
        [{ text: "💳 Karta orqali", callback_data: "pay_card" }]
    ]));
});

// ==========================================
// 6. KARTA TO'LOVI (MUHIM QISM)
// ==========================================
bot.action('pay_card', async (ctx) => {
    let uid = ctx.from.id;
    let cart = carts[uid] || [];
    if (cart.length === 0) return ctx.answerCbQuery("Savatcha bo'sh!");

    let total = 0;
    for (let i = 0; i < cart.length; i++) { total += cart[i].price; }

    // MA'LUMOTLARNI VAQTINCHA SAQLASH (Users ichiga)
    if (!users[uid]) users[uid] = {};
    users[uid].pendingOrder = {
        items: [...cart], // Savatchani nusxalaymiz
        total: total
    };

    let msg = "💳 *To'lov ma'lumotlari:*\n\n" +
              "🔢 Karta: `" + KARTA_RAQAM + "`\n" +
              "👤 Egasi: " + KARTA_E_ISM + "\n" +
              "💰 Summa: *" + total + " so'm*\n\n" +
              "To'lov qilgach tugmani bosing.";

    await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: "✅ To'ladim", callback_data: "confirm_card" }]]
        }
    });
});

bot.action('confirm_card', async (ctx) => {
    let uid = ctx.from.id;
    let userData = users[uid];
    
    // Agar foydalanuvchi ma'lumoti bo'lmasa
    if (!userData || !userData.pendingOrder) {
        return ctx.answerCbQuery("⚠️ Savatcha topilmadi! Iltimos, qaytadan buyurtma bering.", { show_alert: true });
    }

    let orderId = (orderCounter++).toString();
    
    // BUYURTMANI SHAKLLANTIRISH
    orders[orderId] = { 
        userId: uid, 
        phone: userData.phone, 
        latitude: userData.lat, 
        longitude: userData.lon, 
        items: userData.pendingOrder.items, 
        total: userData.pendingOrder.total, 
        payType: 'karta' 
    };

    // SAVATCHANI ENDI TOZALAYMIZ (BUYURTMA TAYYOR BO'LGANIDAN KEYIN)
    carts[uid] = [];
    delete userData.pendingOrder;

    await ctx.editMessageText("📌 Rahmat! Buyurtmangiz #" + orderId + " adminga yuborildi. To'lov chekini " + ADMIN_USERNAME + " ga yuboring.", mainKeyboard);
    await sendOrderToAdmin(orderId);
});

bot.action('pay_cash', async (ctx) => {
    let uid = ctx.from.id;
    let cart = carts[uid] || [];
    let total = 0;
    for (let i = 0; i < cart.length; i++) { total += cart[i].price; }

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
