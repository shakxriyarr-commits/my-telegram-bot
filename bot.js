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

// ✅ KATEGORIYALI MENU
let menu = {
    fastfood: [
        { id: 'b1', name: '🍔 Burger', price: 30000 },
        { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
        { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
        { id: 'l1', name: '🌯 Lavash', price: 32000 }
    ],
    drinks: [
        { id: 'd1', name: '🥤 Cola', price: 10000 },
        { id: 'd2', name: '🧃 Sharbat', price: 12000 }
    ],
    sweets: [
        { id: 's1', name: '🍰 Tort', price: 20000 },
        { id: 's2', name: '🍩 Donut', price: 15000 }
    ]
};

// helper (admin uchun)
function getAllItems() {
    return Object.values(menu).flat();
}

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

// --- ORDER ADMIN ---
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    if (!order) return;

    let itemsText = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');

    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n\n📋 *Tarkibi:*\n${itemsText}\n\n📞 Tel: +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `rej_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)],
            [Markup.button.callback("⏳ Buyurtma ko'p", `busy_${orderId}`)]
        ])
    });

    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// --- START ---
bot.start((ctx) => {
    const id = ctx.from.id;
    if (id === ADMIN_ID) ctx.reply("Admin panel", adminKeyboard);
    else if (COURIERS.some(c => c.id === id)) ctx.reply("Kuryer panel", courierKeyboard);
    else ctx.reply("Xush kelibsiz 👋", mainKeyboard);
});

// ================= MENU =================
bot.hears('🍴 Menyu', (ctx) => {
    ctx.reply("Kategoriya tanlang:", Markup.keyboard([
        ['🍔 Fastfood'],
        ['🥤 Ichimliklar'],
        ['🍰 Shirinliklar'],
        ['⬅️ Orqaga']
    ]).resize());
});

function showCategory(ctx, category) {
    const items = menu[category];

    const buttons = items.map(i =>
        Markup.button.callback(`${i.name}\n${i.price}`, `add_${i.id}`)
    );

    ctx.reply("Tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
}

bot.hears('🍔 Fastfood', (ctx) => showCategory(ctx, 'fastfood'));
bot.hears('🥤 Ichimliklar', (ctx) => showCategory(ctx, 'drinks'));
bot.hears('🍰 Shirinliklar', (ctx) => showCategory(ctx, 'sweets'));

bot.hears('⬅️ Orqaga', (ctx) => ctx.reply("Menu:", mainKeyboard));

// ===== ADD =====
bot.action(/add_(.+)/, async (ctx) => {
    const id = ctx.match[1];

    let item;
    for (let cat in menu) {
        item = menu[cat].find(i => i.id === id);
        if (item) break;
    }

    if (!item) return;

    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push(item);

    await ctx.answerCbQuery("Qo'shildi ✅");
});

// ===== SAVATCHA =====
bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Bo'sh");

    let total = 0;
    let text = "";

    cart.forEach((i, idx) => {
        text += `${idx+1}. ${i.name}\n`;
        total += i.price;
    });

    ctx.reply(`${text}\nJami: ${total}`, Markup.inlineKeyboard([
        [Markup.button.callback("Buyurtma", "order_start")]
    ]));
});

// ===== BUYURTMA =====
bot.action('order_start', (ctx) => {
    ctx.reply("Raqam yuboring", Markup.keyboard([
        [Markup.button.contactRequest("📞")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };

    ctx.reply("Lokatsiya yubor", Markup.keyboard([
        [Markup.button.locationRequest("📍")]
    ]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const id = ctx.from.id;
    const cart = carts[id] || [];
    if (!cart.length) return;

    const total = cart.reduce((a,b)=>a+b.price,0);
    const orderId = orderCounter++;

    orders[orderId] = {
        userId: id,
        phone: users[id].phone,
        latitude: ctx.message.location.latitude,
        longitude: ctx.message.location.longitude,
        items: cart,
        total,
        status: 'Yangi'
    };

    await ctx.reply(`Qabul qilindi #${orderId}`, mainKeyboard);
    await sendOrderToAdmin(orderId);

    carts[id] = [];
});

// ===== ADMIN =====
bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const buttons = getAllItems().map(i => [
        Markup.button.callback(i.name, `edit_${i.id}`)
    ]);

    ctx.reply("Tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/edit_(.+)/, (ctx) => {
    adminState[ctx.from.id] = { step: 'price', id: ctx.match[1] };
    ctx.reply("Yangi narx:");
});

bot.on('text', (ctx, next) => {
    const st = adminState[ctx.from.id];
    if (!st || ctx.from.id !== ADMIN_ID) return next();

    const price = parseInt(ctx.message.text);

    for (let cat in menu) {
        const item = menu[cat].find(i => i.id === st.id);
        if (item) item.price = price;
    }

    delete adminState[ctx.from.id];
    ctx.reply("Yangilandi");
});

// ===== BOT START =====
bot.launch();
