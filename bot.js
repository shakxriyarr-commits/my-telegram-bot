const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN); 
const ADMIN_ID = 8448862547; 

// Siz yuborgan Provider Token
const PAYMENT_TOKEN = '398062629:TEST:999999999_F91D8F69C042267444B74CC0B3C747757EB0E065'; 

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

let orderCounter = 1; 
let stats = { totalSum: 0 }; 
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
    let paymentStatus = order.paymentType === 'cash' ? "💵 Naqd" : "💳 Karta orqali (To'langan ✅)";
    
    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n\n📋 *Tarkibi:*\n${itemsText}\n\n📞 Tel: +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm\n💳 To'lov: ${paymentStatus}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback("🚚 Shahriyor", `assign_${orderId}_6382827314`),
                Markup.button.callback("🚚 Ali", `assign_${orderId}_222222222`)
            ],
            [Markup.button.callback("👨‍🍳 Tayyorlash (Bloklash)", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `reject_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)],
            [Markup.button.callback("⏳ Buyurtma ko'p", `busy_warn_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// --- START ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) ctx.reply("Admin panel!", adminKeyboard);
    else if (COURIERS.some(c => c.id === userId)) ctx.reply("Kuryer paneli!", courierKeyboard);
    else ctx.reply("Coffee Food botiga xush kelibsiz!", mainKeyboard);
});

// --- ADMIN BOSHQARUVI ---
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'name' };
    ctx.reply("Taom nomini yozing:");
});

bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(i.name, `edit_p_${i.id}`)]);
    ctx.reply("Tahrirlash uchun tanlang:", Markup.inlineKeyboard(buttons));
});

bot.hears('🗑 Taomni o\'chirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(`🗑 ${i.name}`, `del_i_${i.id}`)]);
    ctx.reply("O'chirish uchun tanlang:", Markup.inlineKeyboard(buttons));
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
        menu.push({ id: 'm' + Date.now(), name: state.name, price });
        delete adminState[userId];
        ctx.reply("✅ Qo'shildi!", adminKeyboard);
    } else if (state.step === 'new_price') {
        const price = parseInt(ctx.message.text);
        const item = menu.find(i => i.id === state.itemId);
        if (item) item.price = price;
        delete adminState[userId];
        ctx.reply("✅ Yangilandi!", adminKeyboard);
    }
});

// --- MIJOZ LOGIKASI ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name}\n${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("Tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
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
    let text = "🛒 *Savatchangiz:*\n\n";
    cart.forEach((i, idx) => {
        text += `${idx+1}. ${i.name} — ${i.price.toLocaleString()} so'm\n`;
        total += i.price;
    });
    ctx.replyWithMarkdown(`${text}\n💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "checkout")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

bot.action('checkout', (ctx) => {
    ctx.reply("Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { ...users[ctx.from.id], phone: ctx.message.contact.phone_number };
    ctx.reply("Lokatsiyangizni yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId] || !carts[userId].length) return;
    users[userId].location = ctx.message.location;
    await ctx.reply("To'lov turi:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd", "pay_cash"), Markup.button.callback("💳 Click/Payme", "pay_card")]
    ]));
});

// --- TO'LOV ---
bot.action('pay_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];
    const orderId = (orderCounter++).toString();
    orders[orderId] = { userId, phone: users[userId].phone, latitude: users[userId].location.latitude, longitude: users[userId].location.longitude, items: [...cart], total: cart.reduce((a, b) => a + b.price, 0), status: 'Yangi', paymentType: 'cash' };
    await ctx.editMessageText(`✅ #${orderId} qabul qilindi.`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.action('pay_card', async (ctx) => {
    const userId = ctx.from.id;
    const totalSum = carts[userId].reduce((a, b) => a + b.price, 0);
    try {
        await ctx.replyWithInvoice("Coffee Food", "To'lov", `payload_${userId}_${Date.now()}`, PAYMENT_TOKEN, "UZB", [{ label: "Jami", amount: totalSum * 100 }]);
        await ctx.answerCbQuery();
    } catch (e) {
        await ctx.reply(`To'lov tizimida xato.`);
    }
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const orderId = (orderCounter++).toString();
    orders[orderId] = { userId, phone: users[userId].phone, latitude: users[userId].location.latitude, longitude: users[userId].location.longitude, items: [...carts[userId]], total: carts[userId].reduce((a, b) => a + b.price, 0), status: 'To\'landi ✅', paymentType: 'card' };
    await ctx.reply(`✅ #${orderId} to'landi!`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// --- ADMIN/KURYER AMALLARI ---
bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].status = 'Tayyorlanmoqda';
        await bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 #${id} tayyorlanmoqda!`);
        await ctx.answerCbQuery("Bloklandi.");
    }
});

bot.action(/assign_(.+)_(.+)/, (ctx) => {
    const [_, id, cId] = ctx.match;
    const order = orders[id];
    const courier = COURIERS.find(c => c.id == cId);
    if (order && courier) {
        order.status = 'Kuryerda';
        let itemsList = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
        bot.telegram.sendMessage(cId, `📦 *BUYURTMA #${id}*\n\n📋 *Tarkibi:*\n${itemsList}\n\n📞 Tel: +${order.phone}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `c_take_${id}`)],
                [Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]
            ])
        });
        bot.telegram.sendLocation(cId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ #${id} biriktirildi.`);
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].status = 'Yo\'lda 🚚';
        await bot.telegram.sendMessage(orders[id].userId, `🚀 Buyurtmangiz yo'lda!`);
        await ctx.answerCbQuery("Xabar berildi.");
    }
});

bot.action(/c_done_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        stats.totalSum += orders[id].total;
        bot.telegram.sendMessage(orders[id].userId, `🏁 Buyurtmangiz yetkazildi!`);
        bot.telegram.sendMessage(ADMIN_ID, `✅ #${id} topshirildi.`);
        ctx.editMessageText(`🏁 Yakunlandi.`);
        delete orders[id];
    }
});

bot.action(/out_list_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        const buttons = orders[id].items.map((it, idx) => [Markup.button.callback(`❌ ${it.name}`, `c_out_${id}_${idx}`)]);
        ctx.editMessageText("Tugaganini tanlang:", Markup.inlineKeyboard(buttons));
    }
});

bot.action(/c_out_(.+)_(.+)/, async (ctx) => {
    const [_, id, idx] = ctx.match;
    const order = orders[id];
    if (order) {
        const item = order.items[idx];
        order.items.splice(idx, 1);
        order.total -= item.price;
        await bot.telegram.sendMessage(order.userId, `⚠️ Uzr, *${item.name}* tugagan.`);
        ctx.editMessageText(`✅ O'chirildi.`);
    }
});

bot.action(/busy_warn_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        await bot.telegram.sendMessage(orders[id].userId, `⏳ Buyurtmalar ko'p, biroz kechikish bo'lishi mumkin.`);
        await ctx.answerCbQuery("Ogohlantirildi.");
    }
});

bot.action(/reject_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, `❌ Buyurtmangiz #${id} rad etildi.`);
        delete orders[id];
        ctx.editMessageText(`❌ #${id} rad etildi.`);
    }
});

bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id === ADMIN_ID) ctx.reply(`📊 Jami savdo: ${stats.totalSum.toLocaleString()} so'm`);
});

bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz menyusi:", mainKeyboard));
bot.action('clear_cart', (ctx) => { carts[ctx.from.id] = []; ctx.editMessageText("Tozalandi."); });

bot.launch();
