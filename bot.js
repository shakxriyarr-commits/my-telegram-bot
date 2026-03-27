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
let adminState = {}; 

const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Vali" }
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

// --- ADMIN MENYU BOSHQARUVI ---
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'name' };
    ctx.reply("Yangi taom nomini yuboring:");
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

// --- MIJOZ LOGIKASI ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [Markup.button.callback(`${i.name} - ${i.price} so'm`, `add_${i.id}`)]);
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 1 }));
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

bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const myOrders = Object.keys(orders).filter(id => orders[id].userId === ctx.from.id);
    if (!myOrders.length) return ctx.reply("Hozircha faol buyurtmalar yo'q.");
    let text = "🗂 *Sizning buyurtmalaringiz:*\n\n";
    myOrders.forEach(id => {
        text += `🔹 Buyurtma #${id} - Holati: ${orders[id].status || 'Yangi'}\n`;
    });
    ctx.replyWithMarkdown(text);
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
    
    let itemsText = cart.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, lockCancel: false, courierSent: false, addedToStats: false, status: 'Kutilmoqda' };
    
    await ctx.reply("✅ Buyurtmangiz qabul qilindi.", mainKeyboard);
    
    // ADMINGA SMS (Mahsulot tugagan tugmasi qo'shildi)
    await ctx.telegram.sendMessage(ADMIN_ID, `🆕 *YANGI BUYURTMA #${orderId}*\n\n📋 *Mahsulotlar:*\n${itemsText}\n\n📞 +${users[userId].phone}\n💰 Jami: ${total.toLocaleString()} so'm`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Qabul qilish", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `u_cn_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)]
        ])
    });
    // ADMINGA LOKATSIYA
    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = [];
});

// --- ADMIN VA KURYER ACTIONLARI ---
bot.action(/u_cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        await ctx.telegram.sendMessage(order.userId, "🚫 Buyurtmangiz bekor qilindi.");
        delete orders[orderId];
        ctx.editMessageText(`❌ #${orderId} rad etildi.`);
    }
});

bot.action(/ed_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        // Qaysi mahsulot tugaganini birinchi mahsulotdan oladi
        const firstItem = order.items[0].name; 
        await ctx.telegram.sendMessage(order.userId, `⚠️ Uzr, ${firstItem} tugab qolganligi sababli buyurtma bekor qilindi.`);
        delete orders[orderId];
        ctx.editMessageText(`❌ #${orderId} 'Mahsulot tugagan' deb bekor qilindi.`);
    }
});

bot.action(/lock_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        order.lockCancel = true;
        order.status = 'Tayyorlanmoqda';
        await ctx.telegram.sendMessage(order.userId, `👨‍🍳 Buyurtma #${orderId} tayyorlanmoqda. 🔒`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)]
        ]).reply_markup);
    }
});

bot.action(/sd_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
});

bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const [_, orderId, courierId] = ctx.match;
    const order = orders[orderId];
    if (order) {
        order.assignedCourier = courierId;
        order.status = 'Kuryerda';
        await ctx.telegram.sendMessage(courierId, `📦 BUYURTMA #${orderId}\n📞 +${order.phone}\n💰 ${order.total.toLocaleString()}`, {
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `c_take_${orderId}`)],
                [Markup.button.callback("🏁 Topshirdim", `c_done_${orderId}`)]
            ])
        });
        await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ #${orderId} kuryerga yuborildi.`);
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    if (orders[orderId]) {
        orders[orderId].courierSent = true;
        orders[orderId].status = 'Yo\'lda';
        await ctx.telegram.sendMessage(orders[orderId].userId, `🚀 Kuryer buyurtmangizni qabul qildi va yo'lga chiqdi!`);
    }
});

bot.action(/c_done_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    const courierId = ctx.from.id;
    if (order) {
        // STATISTIKA VA ADMINGA HISOBOT
        stats.totalSum += order.total;
        order.items.forEach(i => {
            stats.items[i.name] = (stats.items[i.name] || 0) + 1;
        });
        courierStats[courierId] = (courierStats[courierId] || 0) + 1;

        await ctx.telegram.sendMessage(order.userId, `🏁 Buyurtmangiz yetkazildi. Yoqimli ishtaha! 👋`);
        await ctx.telegram.sendMessage(ADMIN_ID, `✅ BUYURTMA #${orderId} TOPSHIRILDI!\n💰 Summa: ${order.total.toLocaleString()} so'm\n📈 Jami tushum: ${stats.totalSum.toLocaleString()} so'm`);
        ctx.editMessageText(`🏁 #${orderId} yakunlandi.`);
        delete orders[orderId];
    }
});

// --- HISOBOT VA BOSHQA ---
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
    const active = Object.keys(orders).length;
    ctx.reply(`Hozirda ${active} ta faol buyurtma bor.`);
});

bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz rejimi:", mainKeyboard));
bot.hears('📞 Aloqa', (ctx) => ctx.reply("📞 Bog'lanish: +998901234567"));
bot.action('clear_cart', (ctx) => { carts[ctx.from.id] = []; ctx.editMessageText("🗑 Savatcha tozalandi."); });

bot.launch();
