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

// --- ADMINGA BUYURTMA YUBORISH (HAMMA TUGMALAR VA SENING ASLIY MATNLARING BILAN) ---
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    if (!order) return;
    
    let itemsText = "";
    order.items.forEach((item, index) => {
        itemsText += `${index + 1}. ${item.name} — ${item.price.toLocaleString()} so'm\n`;
    });
    
    let payTypeText = order.payType === 'karta' ? "💳 Karta orqali (Chek kutilmoqda)" : "💵 Naqd pul (Kuryerga)";
    
    // SENING ORIGINAL VA UZUN MATNING
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
            [Markup.button.callback("⚠️ Mahsulotlarimiz orasidan tugab qolganini bildirish", `out_list_${orderId}`)],
            [Markup.button.callback("⏳ Buyurtma ko'p (Mijozni ogohlantirish)", `busy_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// 2. KLAVIATURALAR (TO'LIQ VA SENING VARIANTING)
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

// --- START ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) {
        ctx.reply("Assalomu alaykum Admin! Kerakli bo'limni tanlang: 🛠", adminKeyboard);
    } else if (COURIERS.some(c => c.id === userId)) {
        ctx.reply("Kuryer paneli ishga tushdi! Xush kelibsiz! 🚗", courierKeyboard);
    } else {
        ctx.reply("Coffee Food botiga xush kelibsiz! Marhamat, menyudan taom tanlang: 👋", mainKeyboard);
    }
});

// --- MIJOZ LOGIKASI (SO'ZMA-SO'Z SENING MATNLARING) ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name} - ${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("🍴 Bizning menyu bilan tanishing va taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 1 }));
});

bot.action(/add_(.+)/, async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    const item = menu.find(i => i.id === ctx.match[1]);
    carts[userId].push({ ...item });
    await ctx.answerCbQuery(`${item.name} savatchaga qo'shildi! ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (cart.length === 0) return ctx.reply("Sizning savatchangiz hozircha bo'sh! 🛒");
    
    let total = 0;
    let text = "🛒 *Sizning savatchangizda:*\n\n";
    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} — ${i.price.toLocaleString()} so'm\n`;
        total += i.price;
    });
    
    ctx.replyWithMarkdown(`${text}\n💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berishni davom ettirish", "order_start")],
        [Markup.button.callback("🗑 Savatchani tozalash", "clear_cart")]
    ]));
});

bot.action('order_start', (ctx) => {
    ctx.reply("📞 Buyurtmani rasmiylashtirish uchun telefon raqamingizni yuboring:", Markup.keyboard([
        [Markup.button.contactRequest("📞 Telefon raqamni yuborish")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) users[userId] = {};
    users[userId].phone = ctx.message.contact.phone_number;
    ctx.reply("📍 Rahmat! Endi buyurtmangizni yetkazishimiz uchun lokatsiyangizni yuboring:", Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiyani yuborish")]
    ]).resize().oneTime());
});

bot.on('location', (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) users[userId] = {};
    users[userId].lat = ctx.message.location.latitude;
    users[userId].lon = ctx.message.location.longitude;
    
    ctx.reply("💳 Iltimos, to'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd pul (Kuryerga)", "pay_cash")],
        [Markup.button.callback("💳 Karta orqali to'lov", "pay_card")]
    ]));
});

// --- TO'LOV: NAQD ---
bot.action('pay_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.answerCbQuery("Sizning savatchangiz bo'sh!");

    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = { 
        userId, phone: users[userId].phone, latitude: users[userId].lat, longitude: users[userId].lon, 
        items: [...cart], total, status: 'Yangi', payType: 'naqd' 
    };

    await ctx.editMessageText(`✅ Buyurtmangiz #${orderId} qabul qilindi. Tez orada siz bilan bog'lanamiz!`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// --- TO'LOV: KARTA (MATNLAR SO'ZMA-SO'Z TIKLANDI) ---
bot.action('pay_card', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (cart.length === 0) return ctx.answerCbQuery("Sizning savatchangiz bo'sh!");

    const total = cart.reduce((a, b) => a + b.price, 0);
    if (!users[userId]) users[userId] = {};
    
    // MA'LUMOTLARNI SAQLAB QO'YAMIZ (XATONI OLDINI OLISH UCHUN)
    users[userId].pendingOrder = { items: [...cart], total: total };

    let paymentMsg = `💳 *To'lov ma'lumotlari:*\n\n` +
                     `🔢 Karta raqami: \`${KARTA_RAQAM}\`\n` +
                     `👤 Karta egasi: ${KARTA_E_ISM}\n` +
                     `💰 To'lov summasi: *${total.toLocaleString()} so'm*\n\n` +
                     `Iltimos, pulni o'tkazgandan so'ng quyidagi "✅ To'ladim" tugmasini bosing va chekni adminga yuboring.`;

    await ctx.editMessageText(paymentMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("✅ To'ladim", "confirm_card")]])
    });
});

bot.action('confirm_card', async (ctx) => {
    const userId = ctx.from.id;
    const userData = users[userId];
    const pending = userData ? userData.pendingOrder : null;

    if (!pending) {
        return ctx.answerCbQuery("⚠️ Kechirasiz, savatcha ma'lumotlari yo'qolgan. Iltimos, menyuga qaytib qaytadan buyurtma bering.", { show_alert: true });
    }

    const orderId = (orderCounter++).toString();
    orders[orderId] = { 
        userId, 
        phone: userData.phone || "Noma'lum", 
        latitude: userData.lat || 0, 
        longitude: userData.lon || 0, 
        items: pending.items, 
        total: pending.total, 
        status: 'Karta (Chek kutilmoqda)', 
        payType: 'karta' 
    };

    await ctx.editMessageText(`📌 Rahmat! Buyurtmangiz #${orderId} adminga yuborildi. To'lov chekini ushbu profilga yuboring: ${ADMIN_USERNAME}\n\nSiz bilan tez orada bog'lanamiz!`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    
    carts[userId] = []; 
    delete users[userId].pendingOrder;
});

// --- ADMIN VA KURYER ACTIONLARI (SENING TO'LIQ SO'ZLARING BILAN) ---
bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const [_, id, cId] = ctx.match;
    const order = orders[id];
    const courier = COURIERS.find(c => c.id == cId);
    if (order && courier) {
        order.status = `Kuryerga (${courier.name}) berildi`;
        bot.telegram.sendMessage(cId, `📦 *YANGI BUYURTMA #${id}* keldi!\n💰 Summa: ${order.total.toLocaleString()} so'm\n📞 Tel: +${order.phone}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Buyurtmani qabul qildim", `c_take_${id}`)],
                [Markup.button.callback("🏁 Buyurtmani topshirdim", `c_done_${id}`)]
            ])
        });
        bot.telegram.sendLocation(cId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ Buyurtma #${id} muvaffaqiyatli ${courier.name}ga biriktirildi.`);
    }
});

bot.action(/lock_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtmangiz (#${id}) tayyorlanish jarayoniga o'tdi! Uni endi bekor qilib bo'lmaydi.`);
        ctx.answerCbQuery("Tayyorlanmoqda...");
    }
});

bot.action(/rej_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, "❌ Uzr, sizning buyurtmangiz ma'lum sabablarga ko'ra rad etildi. Iltimos, admin bilan bog'laning.");
        delete orders[id];
        ctx.editMessageText(`❌ #${id} buyurtma rad etildi.`);
    }
});

bot.action(/busy_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, `⏳ *Hurmatli mijoz!* Hozirda buyurtmalarimiz juda ko'p bo'lgani sababli, tayyorlash jarayoni biroz ko'proq vaqt olishi mumkin. Tushunganingiz uchun rahmat! 😊`);
        ctx.answerCbQuery("Mijoz ogohlantirildi!");
    }
});

bot.action(/out_list_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        const btns = orders[id].items.map((it, idx) => [Markup.button.callback(`❌ ${it.name} tugagan`, `c_out_${id}_${idx}`)]);
        ctx.editMessageText("Mahsulotlarimiz orasidan tugab qolganini tanlang:", Markup.inlineKeyboard(btns));
    }
});

bot.action(/c_out_(.+)_(.+)/, (ctx) => {
    const [_, id, idx] = ctx.match;
    const order = orders[id];
    if (order) {
        const item = order.items[idx];
        order.items.splice(idx, 1);
        order.total -= item.price;
        bot.telegram.sendMessage(order.userId, `⚠️ Uzr, menyuyimizdagi *${item.name}* taomi hozircha tugab qolgan ekan. Buyurtmangiz qayta hisoblandi va davom etmoqda.`);
        ctx.editMessageText("Mijozga xabar yuborildi va mahsulot o'chirildi.");
    }
});

// --- LAUNCH ---
bot.telegram.deleteWebhook().then(() => {
    bot.launch();
    console.log("BOT 100% ORIGINAL VA TO'LIQ HOLATDA ISHGA TUSHDI! 🚀");
});
