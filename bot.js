const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// ===== CONFIG =====
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067;

// ===== SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

// ===== DATA =====
let orderCounter = 1;
let stats = { totalSum: 0, items: {} };
let courierStats = {};
let adminState = {};

let carts = {};
let orders = {};
let users = {};

// ===== COURIERS =====
const COURIERS = [
    { id: 6382827314, name: "Shahriyor" },
    { id: 222222222, name: "Vali" }
];

// ===== MENU =====
let menu = {
    fastfood: [
        { id: 'b1', name: '🍔 Burger', price: 30000 }
    ],
    drinks: [],
    sweets: []
};

function getAllItems() {
    return Object.values(menu).flat();
}

function findItem(id) {
    for (let cat in menu) {
        let item = menu[cat].find(i => i.id === id);
        if (item) return item;
    }
}

// ===== KEYBOARDS =====
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['🗂 Buyurtmalarim']
]).resize();

const adminKeyboard = Markup.keyboard([
    ['➕ Taom qo\'shish', '✏️ Narxni o\'zgartirish'],
    ['🗑 O\'chirish', '📊 Hisobot']
]).resize();

// ===== START =====
bot.start((ctx) => {
    if (ctx.from.id === ADMIN_ID)
        ctx.reply("Admin panel", adminKeyboard);
    else
        ctx.reply("Xush kelibsiz", mainKeyboard);
});

// ===== ADMIN ADD =====
bot.hears('➕ Taom qo\'shish', ctx => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'name' };
    ctx.reply("Nom:");
});

bot.on('text', (ctx, next) => {
    const st = adminState[ctx.from.id];
    if (!st || ctx.from.id !== ADMIN_ID) return next();

    if (st.step === 'name') {
        st.name = ctx.message.text;
        st.step = 'price';
        ctx.reply("Narx:");
    } else if (st.step === 'price') {
        st.price = parseInt(ctx.message.text);
        st.step = 'category';
        ctx.reply("Kategoriya yozing: fastfood / drinks / sweets");
    } else if (st.step === 'category') {
        const cat = ctx.message.text;
        if (!menu[cat]) return ctx.reply("Noto‘g‘ri kategoriya");

        menu[cat].push({
            id: 'm' + Date.now(),
            name: st.name,
            price: st.price
        });

        delete adminState[ctx.from.id];
        ctx.reply("Qo‘shildi ✅", adminKeyboard);
    }
});

// ===== EDIT PRICE =====
bot.hears('✏️ Narxni o\'zgartirish', ctx => {
    if (ctx.from.id !== ADMIN_ID) return;

    const btns = getAllItems().map(i =>
        [Markup.button.callback(i.name, `edit_${i.id}`)]
    );

    ctx.reply("Tanlang:", Markup.inlineKeyboard(btns));
});

bot.action(/edit_(.+)/, ctx => {
    adminState[ctx.from.id] = { step: 'edit_price', id: ctx.match[1] };
    ctx.reply("Yangi narx:");
});

bot.on('text', (ctx, next) => {
    const st = adminState[ctx.from.id];
    if (!st || st.step !== 'edit_price') return next();

    const item = findItem(st.id);
    if (item) item.price = parseInt(ctx.message.text);

    delete adminState[ctx.from.id];
    ctx.reply("Yangilandi ✅", adminKeyboard);
});

// ===== DELETE =====
bot.hears('🗑 O\'chirish', ctx => {
    if (ctx.from.id !== ADMIN_ID) return;

    const btns = getAllItems().map(i =>
        [Markup.button.callback(i.name, `del_${i.id}`)]
    );

    ctx.reply("Tanlang:", Markup.inlineKeyboard(btns));
});

bot.action(/del_(.+)/, ctx => {
    const id = ctx.match[1];

    for (let cat in menu) {
        const idx = menu[cat].findIndex(i => i.id === id);
        if (idx !== -1) menu[cat].splice(idx, 1);
    }

    ctx.editMessageText("O‘chirildi");
});

// ===== MENU =====
bot.hears('🍴 Menyu', ctx => {
    ctx.reply("Tanlang:", Markup.keyboard([
        ['🍔 Fastfood'],
        ['🥤 Ichimliklar'],
        ['🍰 Shirinliklar']
    ]).resize());
});

function showCat(ctx, cat) {
    const btns = menu[cat].map(i =>
        Markup.button.callback(`${i.name} ${i.price}`, `add_${i.id}`)
    );
    ctx.reply("Tanlang:", Markup.inlineKeyboard(btns));
}

bot.hears('🍔 Fastfood', ctx => showCat(ctx, 'fastfood'));
bot.hears('🥤 Ichimliklar', ctx => showCat(ctx, 'drinks'));
bot.hears('🍰 Shirinliklar', ctx => showCat(ctx, 'sweets'));

// ===== ADD =====
bot.action(/add_(.+)/, ctx => {
    const item = findItem(ctx.match[1]);

    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push(item);

    ctx.answerCbQuery("Qo‘shildi");
});

// ===== CART =====
bot.hears('🛒 Savatcha', ctx => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Bo‘sh");

    let total = cart.reduce((a,b)=>a+b.price,0);

    ctx.reply("Jami: " + total, Markup.inlineKeyboard([
        [Markup.button.callback("Buyurtma", "order")]
    ]));
});

// ===== ORDER =====
bot.action('order', ctx => {
    ctx.reply("Raqam yubor", Markup.keyboard([
        [Markup.button.contactRequest("📞")]
    ]).resize().oneTime());
});

bot.on('contact', ctx => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };

    ctx.reply("Lokatsiya", Markup.keyboard([
        [Markup.button.locationRequest("📍")]
    ]).resize().oneTime());
});

bot.on('location', async ctx => {
    const id = ctx.from.id;
    const cart = carts[id];

    const total = cart.reduce((a,b)=>a+b.price,0);
    const orderId = orderCounter++;

    orders[orderId] = {
        userId: id,
        phone: users[id].phone,
        latitude: ctx.message.location.latitude,
        longitude: ctx.message.location.longitude,
        items: cart,
        total,
        status: 'Yangi',
        lockCancel: false
    };

    await ctx.reply("Qabul qilindi #" + orderId, mainKeyboard);
    await sendOrderToAdmin(orderId);

    carts[id] = [];
});

// ===== ADMIN ORDER =====
async function sendOrderToAdmin(id) {
    const o = orders[id];

    await bot.telegram.sendMessage(ADMIN_ID,
        `#${id}\n${o.items.map(i=>i.name).join(', ')}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("Tayyorlash", `lock_${id}`)],
            [Markup.button.callback("Rad", `rej_${id}`)]
        ])
    );
}

// ===== START BOT =====
bot.launch();
