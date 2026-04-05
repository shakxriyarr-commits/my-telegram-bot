const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// 1. SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN); 
const ADMIN_ID = 8448862547; 

// Siz yuborgan Provider Token (BotFather -> Payments -> Click/Payme)
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

// 3. ADMINGA BUYURTMA YUBORISH FUNKSIYASI (TO'LIQ DETALLARI BILAN)
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
            [Markup.button.callback("⏳ Buyurtma ko'p (Ogohlantirish)", `busy_warn_${orderId}`)]
        ])
    });
    await bot.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
}

// 4. BOT START VA ROLLAR
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) {
        ctx.reply("Assalomu alaykum Admin! Tanlang:", adminKeyboard);
    } else if (COURIERS.some(c => c.id === userId)) {
        ctx.reply("Kuryer paneliga xush kelibsiz!", courierKeyboard);
    } else {
        ctx.reply("Coffee Food botiga xush kelibsiz!", mainKeyboard);
    }
});

// 5. ADMIN: TAOM BOSHQARUV LOGIKASI
bot.hears('➕ Taom qo\'shish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = { step: 'add_name' };
    ctx.reply("Yangi taom nomini kiriting:");
});

bot.hears('✏️ Narxni o\'zgartirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const btns = menu.map(i => [Markup.button.callback(i.name, `edit_pr_${i.id}`)]);
    ctx.reply("Narxini o'zgartirmoqchi bo'lgan taomni tanlang:", Markup.inlineKeyboard(btns));
});

bot.hears('🗑 Taomni o\'chirish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const btns = menu.map(i => [Markup.button.callback(`🗑 ${i.name}`, `del_item_${i.id}`)]);
    ctx.reply("O'chirish uchun tanlang:", Markup.inlineKeyboard(btns));
});

bot.action(/edit_pr_(.+)/, (ctx) => {
    adminState[ctx.from.id] = { step: 'edit_price', itemId: ctx.match[1] };
    ctx.reply("Yangi narxni kiriting (faqat raqam):");
});

bot.action(/del_item_(.+)/, (ctx) => {
    const id = ctx.match[1];
    const index = menu.findIndex(i => i.id === id);
    if (index !== -1) {
        menu.splice(index, 1);
        ctx.editMessageText("✅ Taom menyudan o'chirildi.");
    }
});

bot.on('text', (ctx, next) => {
    const userId = ctx.from.id;
    const state = adminState[userId];
    if (!state || userId !== ADMIN_ID) return next();

    if (state.step === 'add_name') {
        state.name = ctx.message.text;
        state.step = 'add_price';
        ctx.reply(`${state.name} uchun narx kiriting:`);
    } else if (state.step === 'add_price') {
        const pr = parseInt(ctx.message.text);
        if (isNaN(pr)) return ctx.reply("Iltimos, faqat raqam kiriting!");
        menu.push({ id: 'm' + Date.now(), name: state.name, price: pr });
        delete adminState[userId];
        ctx.reply("✅ Taom muvaffaqiyatli qo'shildi!", adminKeyboard);
    } else if (state.step === 'edit_price') {
        const pr = parseInt(ctx.message.text);
        if (isNaN(pr)) return ctx.reply("Iltimos, faqat raqam kiriting!");
        const item = menu.find(i => i.id === state.itemId);
        if (item) item.price = pr;
        delete adminState[userId];
        ctx.reply("✅ Narx yangilandi!", adminKeyboard);
    }
});

// 6. MIJOZ: MENYU VA SAVATCHA LOGIKASI
bot.hears('🍴 Menyu', (ctx) => {
    const btns = menu.map(i => Markup.button.callback(`${i.name} - ${i.price.toLocaleString()} so'm`, `add_to_cart_${i.id}`));
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(btns, { columns: 1 }));
});

bot.action(/add_to_cart_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const item = menu.find(i => i.id === id);
    if (!carts[ctx.from.id]) carts[ctx.from.id] = [];
    carts[ctx.from.id].push({ ...item });
    await ctx.answerCbQuery(`${item.name} savatchaga qo'shildi!`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (cart.length === 0) return ctx.reply("Savatchangiz bo'sh 🛒");

    let total = 0;
    let msg = "🛒 *Savatchangiz:*\n\n";
    cart.forEach((item, index) => {
        msg += `${index + 1}. ${item.name} — ${item.price.toLocaleString()} so'm\n`;
        total += item.price;
    });

    ctx.replyWithMarkdown(`${msg}\n💰 *Jami:* ${total.toLocaleString()} so'm`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "checkout")],
        [Markup.button.callback("🗑 Tozalash", "clear_all")]
    ]));
});

bot.action('clear_all', (ctx) => {
    carts[ctx.from.id] = [];
    ctx.editMessageText("Savatcha tozalandi 🗑");
});

// 7. BUYURTMA BERISH JARAYONI
bot.action('checkout', (ctx) => {
    ctx.reply("Raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("Manzilingizni (lokatsiya) yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiya yuborish")]]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    if (!carts[userId] || carts[userId].length === 0) return;
    users[userId].location = ctx.message.location;

    await ctx.reply("To'lov turini tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("💵 Naqd", "order_cash")],
        [Markup.button.callback("💳 Karta (Click/Payme)", "order_card")]
    ]));
});

// 8. TO'LOV VA BUYURTMA YAKUNI
bot.action('order_cash', async (ctx) => {
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

    await ctx.editMessageText(`✅ Buyurtma #${orderId} qabul qilindi. Tez orada bog'lanamiz.`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

bot.action('order_card', async (ctx) => {
    const userId = ctx.from.id;
    const total = carts[userId].reduce((a, b) => a + b.price, 0);
    try {
        await ctx.replyWithInvoice(
            "Coffee Food",
            "Taomlar to'lovi",
            `payload_${userId}_${Date.now()}`,
            PAYMENT_TOKEN,
            "UZB",
            [{ label: "Jami", amount: total * 100 }]
        );
        await ctx.answerCbQuery();
    } catch (e) {
        await ctx.reply("To'lov tizimida xatolik yuz berdi.");
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
        status: 'To\'langan ✅',
        paymentType: 'card'
    };

    await ctx.reply(`✅ To'lov muvaffaqiyatli! Buyurtma #${orderId} qabul qilindi.`);
    await sendOrderToAdmin(orderId);
    carts[userId] = [];
});

// 9. ADMIN VA KURYER ACTIONLARI (ENG MUHIM QISMLAR)
bot.action(/assign_(.+)_(.+)/, (ctx) => {
    const [_, oId, cId] = ctx.match;
    const order = orders[oId];
    const courier = COURIERS.find(c => c.id == cId);

    if (order && courier) {
        order.status = 'Kuryerda';
        let itemsMsg = order.items.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');
        
        bot.telegram.sendMessage(cId, `📦 *YANGI BUYURTMA #${oId}*\n\n📋 *Tarkibi:*\n${itemsMsg}\n\n📞 Tel: +${order.phone}\n💰 Summa: ${order.total.toLocaleString()} so'm`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("✅ Qabul qildim", `c_take_${oId}`)],
                [Markup.button.callback("🏁 Topshirdim", `c_done_${oId}`)]
            ])
        });
        bot.telegram.sendLocation(cId, order.latitude, order.longitude);
        ctx.editMessageText(`✅ #${oId} buyurtma ${courier.name}ga biriktirildi.`);
    }
});

bot.action(/c_take_(.+)/, async (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        orders[oId].status = 'Yo\'lda';
        await bot.telegram.sendMessage(orders[oId].userId, `🚀 Kuryer buyurtmangizni oldi, yo'lda!`);
        await ctx.answerCbQuery("Mijozga xabar berildi.");
    }
});

bot.action(/c_done_(.+)/, (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        stats.totalSum += orders[oId].total;
        bot.telegram.sendMessage(orders[oId].userId, `🏁 Buyurtmangiz yetkazildi! 👋`);
        ctx.editMessageText(`🏁 Yakunlandi.`);
        delete orders[oId];
    }
});

bot.action(/lock_(.+)/, async (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        await bot.telegram.sendMessage(orders[oId].userId, `👨‍🍳 Buyurtma #${oId} tayyorlanishni boshladi! Uni endi bekor qilib bo'lmaydi.`);
        await ctx.answerCbQuery("Buyurtma bloklandi.");
    }
});

bot.action(/out_list_(.+)/, (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        const btns = orders[oId].items.map((it, idx) => [Markup.button.callback(`❌ ${it.name} tugagan`, `rem_${oId}_${idx}`)]);
        ctx.editMessageText("Qaysi mahsulot tugagan?", Markup.inlineKeyboard(btns));
    }
});

bot.action(/rem_(.+)_(.+)/, async (ctx) => {
    const [_, oId, idx] = ctx.match;
    const order = orders[oId];
    if (order) {
        const removedItem = order.items[idx];
        order.items.splice(idx, 1);
        order.total -= removedItem.price;
        await bot.telegram.sendMessage(order.userId, `⚠️ Uzr, buyurtmangizdagi *${removedItem.name}* tugagan ekan. Qolgan mahsulotlar yuboriladi.`);
        ctx.editMessageText(`✅ ${removedItem.name} o'chirildi.`);
    }
});

bot.action(/busy_warn_(.+)/, async (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        await bot.telegram.sendMessage(orders[oId].userId, `⏳ Buyurtmalar ko'pligi sababli biroz kechikish bo'lishi mumkin. Uzr!`);
        await ctx.answerCbQuery("Mijoz ogohlantirildi.");
    }
});

bot.action(/reject_(.+)/, (ctx) => {
    const oId = ctx.match[1];
    if (orders[oId]) {
        bot.telegram.sendMessage(orders[oId].userId, `❌ Uzr, buyurtmangiz #${oId} qabul qilinmadi.`);
        delete orders[oId];
        ctx.editMessageText(`❌ #${oId} rad etildi.`);
    }
});

bot.hears('📊 Kunlik hisobot', (ctx) => {
    if (ctx.from.id === ADMIN_ID) ctx.reply(`📊 Bugungi jami savdo: ${stats.totalSum.toLocaleString()} so'm`);
});

bot.hears('🏠 Mijoz menyusiga o\'tish', (ctx) => ctx.reply("Mijoz menyusi:", mainKeyboard));

bot.launch();
