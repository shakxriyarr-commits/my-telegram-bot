const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN); 
const ADMIN_ID = 8448862547; 

// Siz yuborgan Provider Token (BotFather'dan olingan)
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

// 2. KLAVIATURALAR (TO'LIQ IERARXIYA)
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

// --- FUNKSIYA: ADMINGA BUYURTMA YUBORISH (HAMMA TUGMALAR BILAN) ---
async function sendOrderToAdmin(orderId) {
    const order = orders[orderId];
    if (!order) return;
    let itemsText = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
    let paymentStatus = order.paymentType === 'cash' ? "💵 Naqd" : "💳 Karta orqali (To'langan ✅)";
    
    await bot.telegram.sendMessage(ADMIN_ID, `🆕 *BUYURTMA #${orderId}*\n\n📋 *Tarkibi:*\n${itemsText}\n\n📞 Tel: +${order.phone}\n💰 Jami: ${order.total.toLocaleString()} so'm\n💳 To'lov: ${paymentStatus}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback("🚚 Shahriyor", `ch_${orderId}_6382827314`),
                Markup.button.callback("🚚 Ali", `ch_${orderId}_222222222`)
            ],
            [Markup.button.callback("👨‍🍳 Tayyorlash (Bloklash)", `lock_${orderId}`)],
            [Markup.button.callback("❌ Rad etish", `rej_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `out_list_${orderId}`)],
            [Markup.button.callback("⏳ Buyurtma ko'p (Ogohlantirish)", `busy_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// --- START VA ROLLARI ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) ctx.reply("Admin panel! 🛠", adminKeyboard);
    else if (COURIERS.some(c => c.id === userId)) ctx.reply("Kuryer paneli! 🚗", courierKeyboard);
    else ctx.reply("Coffee Food botiga xush kelibsiz! 👋", mainKeyboard);
});

// --- ADMIN: TAOM BOSHQARUVI (TO'LIQ LOGIKA) ---
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'name' };
    ctx.reply("Yangi taom nomini yozing:");
});

bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(i.name, `edit_p_${i.id}`)]);
    ctx.reply("Narxni o'zgartirish uchun taomni tanlang:", Markup.inlineKeyboard(buttons));
});

bot.hears('🗑 Taomni o\'chirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const buttons = menu.map(i => [Markup.button.callback(`🗑 ${i.name}`, `del_i_${i.id}`)]);
    ctx.reply("O'chirish uchun taomni tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/edit_p_(.+)/, (ctx) => {
    adminState[ctx.from.id] = { step: 'new_price', itemId: ctx.match[1] };
    ctx.reply("Yangi narxni kiriting:");
});

bot.action(/del_i_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const idx = menu.findIndex(i => i.id === id);
    if (idx !== -1) {
        menu.splice(idx, 1);
        ctx.editMessageText("✅ Taom menyudan olib tashlandi.");
    }
});

bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = adminState[userId];
    if (!state || userId !== ADMIN_ID) return next();

    if (state.step === 'name') {
        state.name = ctx.message.text;
        state.step = 'price';
        ctx.reply(`${state.name} uchun narxni raqamlarda yozing:`);
    } else if (state.step === 'price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply("Faqat raqam kiriting:");
        menu.push({ id: 'm' + Date.now(), name: state.name, price });
        delete adminState[userId];
        ctx.reply("✅ Yangi taom qo'shildi!", adminKeyboard);
    } else if (state.step === 'new_price') {
        const price = parseInt(ctx.message.text);
        if (isNaN(price)) return ctx.reply("Faqat raqam kiriting:");
        const item = menu.find(i => i.id === state.itemId);
        if (item) item.price = price;
        delete adminState[userId];
        ctx.reply("✅ Narx muvaffaqiyatli yangilandi!", adminKeyboard);
    }
});

// --- MIJOZ: MENYU VA SAVATCHA ---
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => Markup.button.callback(`${i.name}\n${i.price.toLocaleString()} so'm`, `add_${i.id}`));
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons, { columns: 2 }));
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
    if (cart.length === 0) return ctx.reply("Savatchangiz hozircha bo'sh 🛒");
    
    let total = 0;
    let text = "🛒 *Savatchangiz:*\n\n";
    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} — ${i.price.toLocaleString()} so'm\n`;
        total += i.price;
    });
    
    ctx.replyWithMarkdown(`${text}\n💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order_start")],
        [Markup.button.callback("🗑 Tozalash", "clear_cart")]
    ]));
});

bot.action('clear_cart', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.editMessageText("Savatcha tozalandi.");
});

bot.action('order_start', (ctx) => {
    ctx.reply("📞 Telefon raqamingizni yuboring:", 
        Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { ...users[ctx.from.id], phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Yetkazish manzilini yuboring:", 
        Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId] || carts[userId].length === 0) return ctx.reply("Savatcha bo'sh!");
    
    users[userId].location = ctx.message.location;
    await ctx.reply("💳 To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd", "pay_cash")],
        [Markup.button.callback("💳 Click / Payme", "pay_card")]
    ]));
});

// --- TO'LOV AMALLARI ---
bot.action('pay_cash', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];
    const orderId = (orderCounter++).toString();
    const total = cart.reduce((a, b) => a + b.price, 0);

    orders[orderId] = {
        userId,
        phone: users[userId].phone,
        latitude: users[userId].location.latitude,
        longitude: users[userId].location.longitude,
        items: [...cart],
        total,
        status: 'Yangi',
        paymentType: 'cash'
    };

    await ctx.editMessageText(`✅ Buyurtma #${orderId} qabul qilindi. To'lov: Naqd.`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.action('pay_card', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId];
    const totalSum = cart.reduce((a, b) => a + b.price, 0);

    try {
        await ctx.replyWithInvoice(
            "Coffee Food",
            "Taomlar to'lovi",
            `pay_${userId}_${Date.now()}`,
            PAYMENT_TOKEN,
            "UZB",
            [{ label: "Summa", amount: totalSum * 100 }]
        );
        await ctx.answerCbQuery();
    } catch (e) {
        await ctx.reply("❌ To'lov tizimida xatolik. Iltimos, qayta urunib ko'ring.");
    }
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const orderId = (orderCounter++).toString();
    const cart = carts[userId];

    orders[orderId] = {
        userId,
        phone: users[userId].phone,
        latitude: users[userId].location.latitude,
        longitude: users[userId].location.longitude,
        items: [...cart],
        total: cart.reduce((a, b) => a + b.price, 0),
        status: 'To\'landi ✅',
        paymentType: 'card'
    };

    await ctx.reply(`✅ To'lov muvaffaqiyatli! Buyurtma #${orderId} qabul qilindi.`, mainKeyboard);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// --- ADMIN VA KURYER BOSHQARUVI (TO'LIQ FUNKSIYALAR) ---
bot.action(/lock_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].status = 'Tayyorlanmoqda';
        await bot.telegram.sendMessage(orders[id].userId, `👨‍🍳 Buyurtma #${id} tayyorlanmoqda! Bekor qilish imkoniyati yopildi.`);
        await ctx.answerCbQuery("Buyurtma tayyorlovga olingan.");
    }
});

bot.action(/ch_(.+)_(.+)/, (ctx) => {
    const [_, id, cId] = ctx.match;
    const order = orders[id];
    const courier = COURIERS.find(c => c.id == cId);
    
    if (order && courier) {
        order.status = 'Kuryerga berildi';
        let itemsList = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
        let payMethod = order.paymentType === 'cash' ? "💵 Naqd" : "💳 To'langan ✅";

        bot.telegram.sendMessage(cId, `📦 *BUYURTMA #${id}*\n\n📋 *Tarkibi:*\n${itemsList}\n\n📞 Tel: +${order.phone}\n💰 Summa: ${order.total.toLocaleString()} so'm\n💳 To'lov: ${payMethod}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `c_take_${id}`)],
                [Markup.button.callback("🏁 Topshirdim", `c_done_${id}`)]
            ])
        });
        bot.telegram.sendLocation(cId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ #${id} buyurtma ${courier.name}ga biriktirildi.`);
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        orders[id].status = 'Yo\'lda 🚚';
        await bot.telegram.sendMessage(orders[id].userId, `🚀 Kuryer buyurtmangizni oldi va yo'lga chiqdi!`);
        await ctx.answerCbQuery("Mijozga xabar yuborildi.");
    }
});

bot.action(/c_done_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        stats.totalSum += orders[id].total;
        bot.telegram.sendMessage(orders[id].userId, `🏁 Buyurtmangiz yetkazildi! 👋`);
        bot.telegram.sendMessage(ADMIN_ID, `✅ Buyurtma #${id} topshirildi.`);
        ctx.editMessageText(`🏁 Yakunlandi.`);
        delete orders[id];
    }
});

bot.action(/out_list_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        const buttons = orders[id].items.map((it, idx) => [Markup.button.callback(`❌ ${it.name} (Tugagan)`, `c_out_${id}_${idx}`)]);
        ctx.editMessageText("Qaysi mahsulot tugaganligini belgilang:", Markup.inlineKeyboard(buttons));
    }
});

bot.action(/c_out_(.+)_(.+)/, async (ctx) => {
    const [_, id, idx] = ctx.match;
    const order = orders[id];
    if (order) {
        const item = order.items[idx];
        order.items.splice(idx, 1);
        order.total -= item.price;
        await bot.telegram.sendMessage(order.userId, `⚠️ Uzr, *${item.name}* tugagan ekan. Buyurtmangiz qolgan qismi yuboriladi.`);
        ctx.editMessageText(`✅ ${item.name} o'chirildi.`);
    }
});

bot.action(/busy_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        await bot.telegram.sendMessage(orders[id].userId, `⏳ Buyurtmalar ko'pligi sababli biroz kechikish bo'lishi mumkin.`);
        await ctx.answerCbQuery("Mijoz ogohlantirildi.");
    }
});

bot.action(/rej_(.+)/, (ctx) => {
    const id = ctx.match[1];
    if (orders[id]) {
        bot.telegram.sendMessage(orders[id].userId, `❌ Uzr, buyurtmangiz qabul qilinmadi.`);
        delete orders[id];
        ctx.editMessageText(`❌ #${id} rad etildi.`);
    }
});

// --- ADMIN: HISOBOT ---
bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply(`📊 Bugungi jami savdo: ${stats.totalSum.toLocaleString()} so'm`);
});

bot.hears('📦 Faol buyurtmalar', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const active = Object.keys(orders);
    if (active.length === 0) return ctx.reply("Hozircha faol buyurtmalar yo'q.");
    active.forEach(id => {
        ctx.reply(`📦 #${id} - ${orders[id].status}\n💰 Summa: ${orders[id].total} so'm`);
    });
});

bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz ko'rinishiga o'tildi:", mainKeyboard));

bot.launch();
