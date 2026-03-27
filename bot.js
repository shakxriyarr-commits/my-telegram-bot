const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let stats = { totalSum: 0, items: {} };
let courierStats = {}; 
let adminState = {}; // Admin harakatlarini eslab qolish uchun

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Vali" }
];

// O'zgaruvchan menu (let qildik, admin o'zgartira olishi uchun)
let menu = [
    { id: 'b1', name: '🍔 Burger', price: 30000 },
    { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
    { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
    { id: 'l1', name: '🌯 Lavash', price: 32000 }
];

let carts = {};
let orders = {};
let users = {};

// 2. KLAVIATURALAR (YANGILANDI)
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim', '📞 Aloqa']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
    ['📊 Kunlik hisobot', '📦 Faol buyurtmalar'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

const courierKeyboard = Markup.keyboard([
    ['🏁 Topshirilgan buyurtmalarim'],
    ['🏠 Mijoz menyusiga o\'tish']
]).resize();

// --- START ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) {
        ctx.reply("Xush kelibsiz, Admin! 🛠", adminKeyboard);
    } else if (COURIERS.some(c => c.id === userId)) {
        ctx.reply("Xush kelibsiz, Kuryer! 🚗", courierKeyboard);
    } else {
        ctx.reply("Xush kelibsiz Coffee Food botiga! 👋", mainKeyboard);
    }
});

// --- ADMIN YANGI FUNKSIYALAR (QO'SHILDI) ---
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'name' };
    ctx.reply("Yangi taom nomini yuboring (masalan: 🍕 Pissa):");
});

bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(i.name, `edit_p_${i.id}`)]);
    ctx.reply("Qaysi taom narxini tahrirlaymiz?", Markup.inlineKeyboard(buttons));
});

bot.action(/edit_p_(.+)/, (ctx) => {
    const itemId = ctx.match[1];
    adminState[ctx.from.id] = { step: 'new_price', itemId };
    ctx.reply("Yangi narxni faqat raqamda yozing:");
});

// Admin matnlarini tutib olish
bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = adminState[userId];
    if (!state || userId !== ADMIN_ID) return next();

    if (state.step === 'name') {
        state.name = ctx.message.text;
        state.step = 'price';
        ctx.reply(`${state.name} uchun narxni yozing:`);
    } else if (state.step === 'price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply("Xato! Faqat raqam yozing:");
        menu.push({ id: 'm' + Date.now(), name: state.name, price: price });
        delete adminState[userId];
        ctx.reply("✅ Taom menyuga qo'shildi!", adminKeyboard);
    } else if (state.step === 'new_price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply("Xato! Faqat raqam yozing:");
        const item = menu.find(i => i.id === state.itemId);
        if (item) item.price = price;
        delete adminState[userId];
        ctx.reply("✅ Narx yangilandi!", adminKeyboard);
    }
});

// --- SIZNING ASLIY KODLARINGIZ (TEGILMADI) ---
bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz rejimi:", mainKeyboard));

bot.hears('🏁 Topshirilgan buyurtmalarim', (ctx) => {
    const courierId = ctx.from.id;
    const count = courierStats[courierId] || 0;
    ctx.replyWithMarkdown(`✅ Siz bugun jami *${count} ta* buyurtmani muvaffaqiyatli topshirdingiz. Barakangizni bersin! 🚀`);
});

bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    let text = "📊 *BUGUNGI HISOBOT:*\n\n";
    if (Object.keys(stats.items).length === 0) text += "Hozircha sotuvlar yo'q.";
    for (let name in stats.items) text += `🔹 ${name}: ${stats.items[name]} ta\n`;
    text += `\n💰 *JAMI TUSHUM:* ${stats.totalSum.toLocaleString()} so'm`;
    ctx.replyWithMarkdown(text);
});

bot.hears('📦 Faol buyurtmalar', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const activeOrders = Object.keys(orders).filter(id => !orders[id].courierSent);
    if (activeOrders.length === 0) return ctx.reply("Hozirda yangi buyurtmalar yo'q. ✅");
    ctx.reply(`Hozirda ${activeOrders.length} ta faol (kuryerga berilmagan) buyurtma bor.`);
});

bot.action(/u_cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Buyurtma topilmadi!");
    if (order.lockCancel) {
        await ctx.answerCbQuery("❌ Buyurtma tayyorlanmoqda, bekor qilib bo'lmaydi!", { show_alert: true });
        return;
    }
    await ctx.telegram.sendMessage(ADMIN_ID, `⚠️ *BUYURTMA RAD ETILDI (#${orderId})*`);
    delete orders[orderId];
    await ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
});

bot.action(/lock_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        order.lockCancel = true;
        await ctx.telegram.sendMessage(order.userId, `👨‍🍳 Buyurtma #${orderId} tayyorlanmoqda. Bekor qilish yopildi! 🔒`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)]
        ]).reply_markup);
        ctx.answerCbQuery("Bekor qilish bloklandi!");
    }
});

bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = ctx.match[2];
    const order = orders[orderId];
    if (!order) return;
    order.assignedCourier = courierId;
    await ctx.telegram.sendMessage(courierId, `📦 YANGI BUYURTMA #${orderId}\n📞 +${order.phone}\n💰 ${order.total.toLocaleString()}`, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ Qabul qildim", `c_take_${orderId}`)],
            [Markup.button.callback("🏁 Topshirdim", `c_done_${orderId}`)]
        ])
    });
    await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
    ctx.editMessageText(`✅ #${orderId} kuryerga yuborildi.`);
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        order.courierSent = true;
        await ctx.telegram.sendMessage(order.userId, `🚀 Kuryer buyurtmangizni qabul qildi va yo'lga chiqdi!`);
        ctx.answerCbQuery("Mijozga bildirishnoma yuborildi!");
    }
});

bot.action(/c_done_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    const courierId = ctx.from.id;
    if (order) {
        courierStats[courierId] = (courierStats[courierId] || 0) + 1;
        if (!order.addedToStats) {
            order.items.forEach(i => {
                stats.items[i.name] = (stats.items[i.name] || 0) + 1;
                stats.totalSum += i.price;
            });
            order.addedToStats = true;
        }
        await ctx.telegram.sendMessage(order.userId, `🏁 Buyurtmangiz yetkazildi. Yoqimli ishtaha! 👋`);
        await ctx.telegram.sendMessage(ADMIN_ID, `✅ #${orderId} kuryer tomonidan topshirildi.`);
        ctx.editMessageText(`🏁 Buyurtma #${orderId} yakunlandi. Jami topshirganlaringiz: ${courierStats[courierId]} ta`);
        delete orders[orderId];
    }
});

bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [Markup.button.callback(`${i.name} - ${i.price} so'm`, `add_${i.id}`)]);
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/add_(.+)/, async (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item, uid: Date.now() + Math.random() });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒");
    let text = "🛒 *Savatchangiz:*\n\n";
    let total = 0;
    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} - ${i.price} so'm\n`;
        total += i.price;
    });
    text += `\n💰 *Jami:* ${total.toLocaleString()} so'm`;
    ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

bot.action('order_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("📞 Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Lokatsiyangizni yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return;
    const { latitude, longitude } = ctx.message.location;
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, lockCancel: false, courierSent: false, addedToStats: false };
    
    await ctx.reply("✅ Buyurtmangiz qabul qilindi.", mainKeyboard);
    await ctx.telegram.sendMessage(ADMIN_ID, `🆕 YANGI BUYURTMA #${orderId}\n📞 +${users[userId].phone}\n💰 Jami: ${total.toLocaleString()} so'm`, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ Qabul qilish", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `u_cn_${orderId}`)]
        ])
    });
});

bot.action(/sd_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
});

bot.action('clear_cart', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.editMessageText("🗑 Savatcha tozalandi.");
});

bot.launch();
