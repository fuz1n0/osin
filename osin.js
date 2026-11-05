import { createHealthServer } from './health-server.js';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

loadEnv();

const config = {
	discordToken: process.env.DISCORD_TOKEN,
	youtubeApiKey: process.env.YOUTUBE_API_KEY,
	youtubeChannel: process.env.YOUTUBE_CHANNEL,
	youtubeNotificationChannelId: process.env.YOUTUBE_NOTIFICATION_CHANNEL_ID,
	youtubeVideoNotificationChannelId: process.env.YOUTUBE_VIDEO_NOTIFICATION_CHANNEL_ID,
	youtubeVideoNotificationRoleId: process.env.YOUTUBE_VIDEO_NOTIFICATION_ROLE_ID,
	tiktokAccount: process.env.TIKTOK_ACCOUNT,
	tiktokNotificationChannelId: process.env.TIKTOK_NOTIFICATION_CHANNEL_ID,
	youtubePollIntervalMs: Number(process.env.YOUTUBE_POLL_INTERVAL_MS) || 1_800_000,
	tiktokPollIntervalMs: Number(process.env.TIKTOK_POLL_INTERVAL_MS) || 60_000,
};

if (!config.discordToken) {
	console.error('Thiếu DISCORD_TOKEN. Hãy tạo file .env theo mẫu .env.example.');
	process.exit(1);
}

// ==========================================
// 1. KHỞI TẠO DISCORD & BỘ NÃO AI
// ==========================================
const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent ]});
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const cacBuaChu = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash", safetySettings: cacBuaChu }); 
let isOsinEnabled = true;
const cooldowns = new Map(); 
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function osinTraTreo(tinNhanCuaKhach, tenKhach, idKhach) {
    const ID_SEP_THANG = '1254142011863339039'; 
    const isBoss = (idKhach === ID_SEP_THANG);

    const thaiDo = isBoss 
        ? "NGƯỜI ĐANG CHAT LÀ SẾP TỔNG WINHP! Mày phải dạ vâng ngoan ngoãn, xưng 'em' gọi 'sếp'. Nhưng KHÔNG ĐƯỢC NỊNH HÓT! Hãy đóng vai Osin Gen Z hay than vãn, khịa ngầm sếp vài câu mặn chát, than nghèo kể khổ đòi tăng lương. Lễ phép nhưng mỏ vẫn hỗn ngầm!" 
        : "Tính cách của mày: Osin mỏ hỗn, bẩn bựa, hay cà khịa, chửi thề sương sương, xưng hô tao-mày. Nếu khách gọi bằng từ thân mật (eiu, baby...), hãy lả lơi đùa cợt rồi chửi yêu bẩn bựa. LƯU Ý TỐI QUAN TRỌNG: KHÔNG ĐƯỢC TỰ NHIÊN NHẮC ĐẾN SẾP WINHP nếu khách không nhắc tới! Đứa nào chat thì mày tập trung khịa thẳng mặt đứa đó thôi!";

    // Đã gọt sạch chữ "của sếp Winhp" ở câu giới thiệu chung
    const thanChú = `Mày là 'Osin', bot tấu hài trong server Discord 'HỘI HÀI DÓN'. Người đang chat là: ${tenKhach}. ${thaiDo}\nKhách vừa chat: "${tinNhanCuaKhach}". Hãy rep lại 1-2 câu thật ngắn gọn, súc tích!`;

    for (let i = 0; i < 3; i++) {
        try {
            const result = await model.generateContent(thanChú);
            return (await result.response).text();
        } catch (error) {
            let maLoi = error.status || error.code || (error.message.match(/\b(4\d\d|5\d\d)\b/)?.[0]) || "Không rõ";
            if (maLoi == '429' && i < 2) { await sleep(5000); continue; }
            return `Má nó, tụi mày spam quá API Google đang bị kẹt mạng rồi (Mã lỗi: ${maLoi}). Đợi 1 phút rồi hẵng réo tao nha!`;
        }
    }
}

// ==========================================
// 2. LẮNG NGHE LỆNH DISCORD
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const noiDung = message.content.toLowerCase().trim();

    if (noiDung === 'osin off' || noiDung === 'osin on') {
        if (!message.member.permissions.has('Administrator')) return message.reply('Mày tuổi gì đòi rọ mõm tao? Kêu sếp Thắng ra đây nói chuyện!');
        isOsinEnabled = (noiDung === 'osin on');
        return message.reply(isOsinEnabled ? 'Osin đã thức giấc! Đứa nào láo nháo tao tế sống!' : 'Đã ngậm mồm! Osin đi ngủ đây, cấm đứa nào làm phiền!');
    }

    if (!isOsinEnabled) return;
    let biReo = noiDung.includes('osin') || message.mentions.has(client.user.id);
    if (!biReo && message.reference) {
        const tinNhanGoc = await message.fetchReference().catch(() => null);
        if (tinNhanGoc && tinNhanGoc.author.id === client.user.id) biReo = true; 
    }

    if (biReo) {
        const thoiGianCho = 2000; 
        if (cooldowns.has(message.author.id) && Date.now() < cooldowns.get(message.author.id) + thoiGianCho) {
            const conLai = (((cooldowns.get(message.author.id) + thoiGianCho) - Date.now()) / 1000).toFixed(1);
            return message.reply(`Spam cc à? Bố mày đang bận dọn WC, ${conLai}s nữa quay lại sủa tiếp!`);
        }
        cooldowns.set(message.author.id, Date.now());
        setTimeout(() => cooldowns.delete(message.author.id), thoiGianCho);

        let cauHoi = message.content.replace(/osin/gi, '').replace(`<@${client.user.id}>`, '').replace(`<@!${client.user.id}>`, '').trim();
        if (!cauHoi || cauHoi.length < 2) cauHoi = "Tao vừa réo tên mày cho vui thôi chứ không có việc gì đâu. Chửi tao một câu thật mỏ hỗn vì tội làm phiền đi!";
        else if (cauHoi.length > 300) return message.reply('Mày viết sớ tế sao à? Dài quá tao lười đọc, túm cái váy lại dưới 300 chữ lẹ lên!');

        await message.channel.sendTyping();
        const cauTraLoi = await osinTraTreo(cauHoi, (message.member ? message.member.displayName : message.author.username), message.author.id);
        return message.reply({ content: cauTraLoi, allowedMentions: { repliedUser: false } });
    }
});

// ==========================================
// 3. SERVER GIỮ MẠNG (UPTIME ROBOT YÊU THÍCH CỦA NGÀI)
// ==========================================
const healthServer = createHealthServer(() => client.isReady());

healthServer.on('error', (error) => {
	console.error('Không thể khởi động health server:', error);
	process.exit(1);
});

healthServer.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => {
	console.log(`Health server đang lắng nghe trên port ${healthServer.address().port}.`);
});

// ==========================================
// 4. KHO TÀNG 15 CÂU THÔNG BÁO HỆ GEN Z MỎ HỖN
// ==========================================
const ytLiveTemplates = [
    '🔴 ÉT Ô ÉT! Sếp Winhp đang lên live rắc muối trên YouTube rùi ae ơi! Khum xem đêm nay mất ngủ ráng chịu nha: {url}',
    '🔴 Kèo thơm kèo thơm! Sếp Thắng đang live YouTube gòi. AE vào buff view nhiệt tình cho Osin có tiền mua trà sữa coi, nghèo quá rùi: {url}',
    '🔴 Đỉnh nóc kịch trần bay phấp phới lun ae ơi! Sếp Thắng đang live YouTube, vứt hết deadline vào donate cho sếp lẹ: {url}',
    '🔴 Trầm cảm quá thì làm gì? Lên YouTube xem idol Winhp tấu hề chữa lành (hoặc rách vết thương) nà mấy bácc: {url}',
    '🔴 Ai đó giải cứu sếp Thắng khỏi sự vô tri này đi!! Sếp đang gào thét trên YouTube kìa mấy má, link đây nhấp lẹ: {url}'
];

const ttLiveTemplates = [
    '🎵 Ối dồi ôi, idol Winhp đang ngoáy mông trên tóp tóp kìa! AE bơi vào nhấp tim cháy máy cho sếp sướng coi: {url}',
    '🎵 Cảm lạnh thực sự... Sếp Thắng đang live tóp tóp làm trò con bò kìa ae ơi, vào xem ổng flex độ vô tri nà: {url}',
    '🎵 Quá ố dề rùi! Sếp Winhp đang múa quạt trên tóp tóp, ae vào spam comment khịa ổng lẹ lên: {url}',
    '🎵 Sếp Thắng đang live tóp tóp lùa gà kìa ae!! Nhanh tay vào thả tim khum ổng dỗi ổng trừ lương Osin bi chừ: {url}',
    '🎵 Hội mỏ hỗn điểm danh! Sếp Thắng đang live tóp tóp, ae vào combat bằng tim cho sập cái live của ổng lun điiii: {url}'
];

const ytVideoTemplates = [
    '📺 Mới ra lò nóng hổi lun! Sếp Thắng vừa thả xích siêu phẩm: **{title}**\nKhứa nào khum xem sếp tế sống ráng chịu: {url}',
    '📺 Đỉnh của chóp!! Sếp Winhp vừa up video mới dòi: **{title}**\nCày view lẹ cho sếp mua mồi cho Osin ăn coi: {url}',
    '📺 Chằm zn với content này lun á! Sếp Thắng vừa ra lò quả video nhức nách: **{title}**\nBấm zô cày lẹ, khum xem tiếc 10 kiếp: {url}',
    '📺 Ê nhõi, sếp Thắng mới ra clip mới kìa: **{title}**\nLuật hoa quả không chừa một ai nếu ae khum bấm vào cái link này cày view: {url}',
    '📺 Hào quang rực rỡ chiếu rọi Tửu Lầu! Sếp Thắng vừa nhả video: **{title}**\nVào thẩm lẹ, 10 điểm không có nhưng nàoooo: {url}'
];

function pickRandomMsg(templates, url, title = '') {
    return templates[Math.floor(Math.random() * templates.length)].replace('{url}', url).replace('{title}', title);
}

// ==========================================
// 5. THÔNG BÁO LIVE VÀ VIDEO YT / TIKTOK
// ==========================================
let cachedYoutubeChannelId, youtubeUploadsPlaylistId, announcedYoutubeLiveId, announcedYoutubeUploadId;
let initializedYoutubeVideos = false;
let initializedYoutubeLive = false; // Bùa chống spam YT lúc mới dậy
const announcedYoutubeLiveIds = new Set();
const tiktokConnection = config.tiktokAccount ? new TikTokLiveConnection(config.tiktokAccount.match(/@([\w.-]+)/)?.[1] ?? config.tiktokAccount.trim().replace(/^@/, '').replace(/\/$/, ''), {}) : null;
let wasTikTokLive = false;
let initializedTikTokLive = false; // Bùa chống spam TikTok lúc mới dậy

async function youtubeApiRequest(params) {
    const url = new URL('https://www.googleapis.com/youtube/v3/' + params.endpoint);
    for (const [key, value] of Object.entries(params.query)) url.searchParams.set(key, value);
    url.searchParams.set('key', config.youtubeApiKey);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`YouTube API trả về HTTP ${response.status}.`);
    return response.json();
}

async function checkYouTube() {
    if (!cachedYoutubeChannelId) {
        const ref = config.youtubeChannel.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{22})/i)?.[1] ? { id: config.youtubeChannel.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{22})/i)[1] } : { forHandle: config.youtubeChannel.match(/@([\w.-]+)/)?.[1] ?? config.youtubeChannel.trim().replace(/^@/, '') };
        const data = await youtubeApiRequest({ endpoint: 'channels', query: { part: 'id,contentDetails', ...ref } });
        cachedYoutubeChannelId = data.items?.[0]?.id;
        youtubeUploadsPlaylistId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    }
    // Check Live
    if (config.youtubeNotificationChannelId) {
        const liveData = await youtubeApiRequest({ endpoint: 'search', query: { part: 'id', channelId: cachedYoutubeChannelId, eventType: 'live', type: 'video', maxResults: '1' } });
        const videoId = liveData.items?.[0]?.id?.videoId;
        
        // 🔮 KÍCH HOẠT BÙA CHỐNG SPAM: Lần check đầu tiên chỉ ghi nhớ, CẤM SỦA!
        if (!initializedYoutubeLive) {
            announcedYoutubeLiveId = videoId;
            if (videoId) announcedYoutubeLiveIds.add(videoId);
            initializedYoutubeLive = true;
        } else if (videoId && videoId !== announcedYoutubeLiveId) {
            const channel = await client.channels.fetch(config.youtubeNotificationChannelId);
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            const msg = pickRandomMsg(ytLiveTemplates, url);
            if (channel?.isTextBased()) await channel.send({ content: `@everyone\n${msg}`, allowedMentions: { parse: ['everyone'] } });
            announcedYoutubeLiveId = videoId;
            announcedYoutubeLiveIds.add(videoId);
        }
    }
    // Check Video
    if (config.youtubeVideoNotificationChannelId) {
        const vidData = await youtubeApiRequest({ endpoint: 'playlistItems', query: { part: 'snippet', playlistId: youtubeUploadsPlaylistId, maxResults: '1' } });
        const videoId = vidData.items?.[0]?.snippet?.resourceId?.videoId;
        if (!initializedYoutubeVideos) { announcedYoutubeUploadId = videoId; initializedYoutubeVideos = true; return; }
        if (videoId && videoId !== announcedYoutubeUploadId && !announcedYoutubeLiveIds.has(videoId)) {
            const details = await youtubeApiRequest({ endpoint: 'videos', query: { part: 'snippet,liveStreamingDetails', id: videoId } });
            if (details.items?.[0]?.snippet?.liveBroadcastContent === 'none' && !details.items?.[0]?.liveStreamingDetails) {
                const channel = await client.channels.fetch(config.youtubeVideoNotificationChannelId);
                const roleMention = config.youtubeVideoNotificationRoleId ? `<@&${config.youtubeVideoNotificationRoleId}> ` : '@everyone ';
                const safeTitle = details.items[0].snippet.title.replace(/@/g, '@\u200b');
                const url = `https://www.youtube.com/watch?v=${videoId}`;
                const msg = pickRandomMsg(ytVideoTemplates, url, safeTitle);
                if (channel?.isTextBased()) await channel.send({ content: `${roleMention}${msg}`, allowedMentions: { parse: config.youtubeVideoNotificationRoleId ? [] : ['everyone'], roles: config.youtubeVideoNotificationRoleId ? [config.youtubeVideoNotificationRoleId] : [] } });
                announcedYoutubeUploadId = videoId;
            }
        }
    }
}

async function checkTikTokLive() {
    if (!tiktokConnection) return;
    const isLive = await tiktokConnection.fetchIsLive();
    
    // 🔮 KÍCH HOẠT BÙA CHỐNG SPAM TIKTOK TƯƠNG TỰ
    if (!initializedTikTokLive) {
        wasTikTokLive = isLive;
        initializedTikTokLive = true;
        return;
    }

    if (isLive && !wasTikTokLive) {
        const channel = await client.channels.fetch(config.tiktokNotificationChannelId);
        const username = config.tiktokAccount.match(/@([\w.-]+)/)?.[1] ?? config.tiktokAccount.trim().replace(/^@/, '').replace(/\/$/, '');
        const url = `https://www.tiktok.com/@${username}/live`;
        const msg = pickRandomMsg(ttLiveTemplates, url);
        if (channel?.isTextBased()) await channel.send({ content: `@everyone\n${msg}`, allowedMentions: { parse: ['everyone'] } });
    }
    wasTikTokLive = isLive;
}

client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ [THÀNH CÔNG] Bot đã online: ${readyClient.user.tag}`);
    if (config.youtubeApiKey) setInterval(checkYouTube, config.youtubePollIntervalMs);
    if (config.tiktokAccount) setInterval(checkTikTokLive, config.tiktokPollIntervalMs);
});

client.login(config.discordToken);

// ==========================================
// 6. BÍ THUẬT "ĐÁNH SẬP ĐỂ LUÂN HỒI" (AUTO-RESTART)
// ==========================================
const THOI_GIAN_RESET_GIO = 5; 
setInterval(() => {
    console.log(`🚨 [AUTO-RESET] Đã chạy đủ ${THOI_GIAN_RESET_GIO} tiếng! Tự động sập nguồn để Render reset lại bộ nhớ!`);
    process.exit(0); 
}, THOI_GIAN_RESET_GIO * 60 * 60 * 1000);