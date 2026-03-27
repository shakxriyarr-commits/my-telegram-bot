const { Telegraf, Markup } = require('telegraf');
const express = require('express');

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

bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) ctx.reply("Admin panel! 🛠", adminKeyboard);
    else if (COURIERS.some(c => c.id === userId)) ctx.reply("Kuryer paneli! 🚗", courierKeyboard);
    else ctx.reply("Coffee Food botiga xush kelibsiz! 👋", mainKeyboard);
});

// --- KURYERLAR BO'LIMI VA STATISTIKASI ---
bot.hears('🏁 Topshirilgan buyurtmalarim', (ctx) => {
    const courierId = ctx.from.id;
    if (!COURIERS.some(c => c.id === courierId)) return;
    const count = courierStats[courierId] || 0;
    ctx.replyWithMarkdown(`✅ Siz bugun jami *${count} ta* buyurtmani muvaffaqiyatli topshirdingiz. Barakangizni bersin! 🚀`);
});

// --- ADMIN: KURYERGA YUBORISH ---
bot.action(/sd_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageText(`Buyurtma #${orderId} uchun kuryerni tanlang:`, Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const courierId = ctx.match[2];
    const order = orders[orderId];
    
    if (order) {
        order.status = 'Kuryerda';
        // Kuryerga xabar yuborish
        bot.telegram.sendMessage(courierId, `📦 *YANGI BUYURTMA #${orderId}*\n📞 +${order.phone}\n💰 Summa: ${order.total.toLocaleString()} so'm`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `c_take_${orderId}`)],
                [Markup.button.callback("🏁 Topshirdim", `c_done_${orderId}`)]
            ])
        });
        bot.telegram.sendLocation(courierId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ #${orderId}-buyurtma kuryerga yuborildi.`);
    }
});

// --- KURYER: QABUL QILISH VA TOPSHIRISH ---
bot.action(/c_take_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    if (orders[orderId]) {
        orders[orderId].status = 'Yo\'lda';
        bot.telegram.sendMessage(orders[orderId].userId, `🚀 Kuryer buyurtmangizni qabul qildi va yo'lga chiqdi!`);
        ctx.answerCbQuery("Mijozga bildirishnoma yuborildi!");
    }
});

bot.action(/c_done_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    const courierId = ctx.from.id;

    if (order) {
        // Statistika yuritish
        stats.totalSum += order.total;
        order.items.forEach(i => stats.items[i.name] = (stats.items[i.name] || 0) + 1);
        courierStats[courierId] = (courierStats[courierId] || 0) + 1;

        bot.telegram.sendMessage(order.userId, `🏁 Buyurtmangiz yetkazildi. Yoqimli ishtaha! 👋`);
        bot.telegram.sendMessage(ADMIN_ID, `✅ Buyurtma #${orderId} topshirildi!\n💰 Summa: ${order.total.toLocaleString()} so'm.`);
        ctx.editMessageText(`🏁 #${orderId} yakunlandi. Bugun jami: ${courierStats[courierId]} ta`);
        delete orders[orderId];
    }
});

// --- MIJOZ: BUYURTMALARIM (TARKIBI VA BEKOR QILISH BILAN) ---
bot.hears('🗂 Buyurtmalarim', (ctx) => {
    const myOrders = Object.keys(orders).filter(id => orders[id].userId === ctx.from.id);
    if (!myOrders.length) return ctx.reply("Sizda faol buyurtmalar yo'q.");
    
    myOrders.forEach(id => {
        const order = orders[id];
        let itemsList = order.items.map(i => i.name).join(', ');
        let text = `📦 *Buyurtma #${id}*\n📋 Tarkibi: ${itemsList}\n💰 Jami: ${order.total.toLocaleString()} so'm\n📊 Holati: *${order.status}*`;
        
        const btn = !order.lockCancel ? Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${id}`)]]) : null;
        ctx.replyWithMarkdown(text, btn);
    });
});

// --- ADMIN: MAHSULOT TUGAGAN ---
bot.action(/out_list_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) {
        const buttons = order.items.map((item, idx) => [
            Markup.button.callback(`❌ ${item.name} tugagan`, `out_fin_${orderId}_${idx}`)
        ]);
        ctx.editMessageText(`Buyurtma #${orderId} - qaysi mahsulot tugagan?`, Markup.inlineKeyboard(buttons));
    }
});

bot.action(/out_fin_(.+)_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const itemIdx = ctx.match[2];
    if (orders[orderId]) {
        const itemName = orders[orderId].items[itemIdx].name;
        bot.telegram.sendMessage(orders[orderId].userId, `⚠️ Uzr, buyurtmangizdagi *${itemName}* tugab qolgani sababli buyurtma bekor qilindi.`);
        delete orders[orderId];
        ctx.editMessageText(`✅ #${orderId} "${itemName}" tugagani uchun bekor qilindi.`);
    }
});

// --- QOLGAN LOGIKALAR (Menyu, Savatcha, Location) ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name}\n${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
});

bot.action(/add_(.+)/, async (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push({ ...item });
    await ctx.answerCbQuery(`${item.name} qo'shildi ✅`);
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return;
    const { latitude, longitude } = ctx.message.location;
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);
    
    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total, status: 'Yangi', lockCancel: false };
    
    await ctx.reply(`✅ Buyurtmangiz qabul qilindi (#${orderId}).`, Markup.inlineKeyboard([[Markup.button.callback("🚫 Bekor qilish", `u_cn_${orderId}`)]]));
    
    let itemsText = cart.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    await ctx.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n📞 +${users[userId].phone}\n📋 *Tarkibi:*\n${itemsText}\n💰 Jami: ${total.toLocaleString()} so'm`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("👨‍🍳 Tayyorlash", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `rej_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)]
        ])
    });
    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = [];
});

bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].lockCancel = true;
        orders[id].status = 'Tayyorlanmoqda';
        bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtmangiz #${id} tayyorlanmoqda! Uni endi bekor qila olmaysiz. 🔒`);
        ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${id}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${id}`)]
        ]).reply_markup);
    }
});

bot.action(/u_cn_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        if (orders[id].lockCancel) return ctx.answerCbQuery("❌ Kechirasiz, buyurtma tayyorlanmoqda, endi bekor qilib bo'lmaydi!", { show_alert: true });
        delete orders[id];
        ctx.editMessageText("🚫 Buyurtmangiz bekor qilindi.");
    }
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒");
    let total = cart.reduce((a, b) => a + b.price, 0);
    ctx.replyWithMarkdown(`🛒 *Savatchangiz:*\n\n💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

bot.action('order_start', (ctx) => ctx.reply("📞 Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime()));
bot.on('contact', (ctx) => { users[ctx.from.id] = { phone: ctx.message.contact.phone_number }; ctx.reply("📍 Lokatsiya yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya")]]).resize().oneTime()); });
bot.action('clear_cart', (ctx) => { carts[ctx.from.id] = []; ctx.editMessageText("Savatcha tozalandi."); });
bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("O'tildi:", mainKeyboard));

bot.launch();
