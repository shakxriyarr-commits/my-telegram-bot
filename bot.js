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
    if (userId === ADMIN_ID) ctx.reply("Admin panel! 🛠", adminKeyboard);
    else if (COURIERS.some(c => c.id === userId)) ctx.reply("Kuryer paneli! 🚗", courierKeyboard);
    else ctx.reply("Coffee Food botiga xush kelibsiz! 👋", mainKeyboard);
});

// --- MIJOZ: MENYU (KATTA TUGMALAR) ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = [];
    for (let i = 0; i < menu.length; i += 2) {
        const row = [menu[i].name];
        if (menu[i + 1]) row.push(menu[i + 1].name);
        buttons.push(row);
    }
    buttons.push(['🛒 Savatcha', '🏠 Asosiy menyu']);
    ctx.reply("Taom tanlang (qo'shish uchun bosing):", Markup.keyboard(buttons).resize());
});

// --- MAHSULOTNI SAVATGA QO'SHISH ---
menu.forEach(item => {
    bot.hears(item.name, (ctx) => {
        const userId = ctx.from.id;
        if (!carts[userId]) carts[userId] = [];
        carts[userId].push({ ...item });
        
        const count = carts[userId].filter(i => i.name === item.name).length;
        ctx.reply(`✅ ${item.name} qo'shildi! (Savatda: ${count} ta)`);
    });
});

// --- SAVATCHA ---
bot.hears('🛒 Savatcha', (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒", mainKeyboard);

    let total = 0;
    let itemsText = "🛒 *Savatchangiz:*\n\n";
    const summary = {};
    
    cart.forEach(item => {
        summary[item.name] = (summary[item.name] || 0) + 1;
        total += item.price;
    });

    for (const [name, qty] of Object.entries(summary)) {
        itemsText += `🔸 ${name} x ${qty}\n`;
    }
    itemsText += `\n💰 *Jami:* ${total.toLocaleString()} so'm`;

    ctx.replyWithMarkdown(itemsText, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

// --- BUYURTMA JARAYONI ---
bot.action('order_start', (ctx) => {
    ctx.reply("📞 Telefon raqamingizni yuboring:", 
        Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Endi lokatsiya yuboring:", 
        Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length || !users[userId]) return;

    const { latitude, longitude } = ctx.message.location;
    const orderId = orderCounter++;
    const total = cart.reduce((a, b) => a + b.price, 0);
    
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, status: 'Kutilmoqda', lockCancel: false };
    
    await ctx.reply(`✅ Buyurtma #${orderId} qabul qilindi!`, mainKeyboard);
    
    let itemsText = cart.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n📞 Tel: ${users[userId].phone}\n📋 Tarkibi:\n${itemsText}\n💰 Jami: ${total.toLocaleString()}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `rej_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = [];
});

// --- ADMIN VA KURYER FUNKSIYALARI ---
bot.action(/lock_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].lockCancel = true;
        orders[id].status = 'Tayyorlanmoqda';
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtma #${id} tayyorlanmoqda!`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga", `sd_${id}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${id}`)]
        ]).reply_markup);
    }
});

bot.action(/sd_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${id}_${c.id}`)]);
    ctx.editMessageText(`Kuryerni tanlang (#${id}):`, Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const [_, id, cId] = ctx.match;
    if (orders[id]) {
        orders[id].status = 'Yo\'lda';
        bot.telegram.sendMessage(cId, `📦 BUYURTMA #${id}\n💰 ${orders[id].total} so'm`, 
            Markup.inlineKeyboard([[Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]]));
        bot.telegram.sendLocation(cId, orders[id].latitude, orders[id].longitude);
        ctx.editMessageText(`✅ #${id} kuryerga yuborildi.`);
    }
});

bot.action(/c_done_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const order = orders[id];
    if (order) {
        stats.totalSum += order.total;
        courierStats[ctx.from.id] = (courierStats[ctx.from.id] || 0) + 1;
        bot.telegram.sendMessage(order.userId, `🏁 Buyurtmangiz yetkazildi!`);
        bot.telegram.sendMessage(ADMIN_ID, `✅ #${id} topshirildi.`);
        ctx.editMessageText(`🏁 #${id} yakunlandi.`);
        delete orders[id];
    }
});

bot.hears('🏠 Asosiy menyu', (ctx) => ctx.reply("Asosiy menyu:", mainKeyboard));
bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz rejimi:", mainKeyboard));
bot.action('clear_cart', (ctx) => { carts[ctx.from.id] = []; ctx.editMessageText("Savatcha tozalandi."); });

bot.launch();
