import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

loadEnv();

// ─── CẤU HÌNH ────────────────────────────────────────────────────────────────
const cfg = {
	discordToken:                process.env.DISCORD_TOKEN,
	googleApiKey:                process.env.GOOGLE_API_KEY,
	youtubeApiKey:               process.env.YOUTUBE_API_KEY,
	youtubeChannel:              process.env.YOUTUBE_CHANNEL,
	ytLiveChannelId:             process.env.YOUTUBE_NOTIFICATION_CHANNEL_ID,
	ytVideoChannelId:            process.env.YOUTUBE_VIDEO_NOTIFICATION_CHANNEL_ID,
	ytVideoRoleId:               process.env.YOUTUBE_VIDEO_NOTIFICATION_ROLE_ID,
	tiktokAccount:               process.env.TIKTOK_ACCOUNT,
	ttLiveChannelId:             process.env.TIKTOK_NOTIFICATION_CHANNEL_ID,
	youtubePollMs: Number(process.env.YOUTUBE_POLL_INTERVAL_MS) || 1_800_000,
	tiktokPollMs:  Number(process.env.TIKTOK_POLL_INTERVAL_MS)  ||    60_000,
};

if (!cfg.discordToken) {
	console.error('❌ Thiếu DISCORD_TOKEN.');
	process.exit(1);
}

// ─── DISCORD & AI ─────────────────────────────────────────────────────────────
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const genAI   = new GoogleGenerativeAI(cfg.googleApiKey ?? '');
const noFilter = [
	{ category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
	{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
	{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
	{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', safetySettings: noFilter });

let isOsinEnabled = true;
const cooldowns  = new Map();
const sleep      = (ms) => new Promise((r) => setTimeout(r, ms));

async function osinTraTreo(tin, ten, id) {
	const isBoss = (id === '1254142011863339039');
	const thaiDo = isBoss
		? 'NGƯỜI ĐANG CHAT LÀ SẾP TỔNG WINHP! Mày phải dạ vâng ngoan ngoãn, xưng "em" gọi "sếp". Nhưng KHÔNG NỊNH HÓT! Hãy đóng vai Osin Gen Z hay than vãn, khịa ngầm sếp vài câu mặn chát, than nghèo đòi tăng lương. Lễ phép nhưng mỏ vẫn hỗn ngầm!'
		: 'Tính cách: Osin mỏ hỗn, bẩn bựa, hay cà khịa, chửi thề sương sương, xưng hô tao-mày. Nếu khách gọi thân mật (eiu, baby...) thì lả lơi rồi chửi yêu bẩn bựa. TUYỆT ĐỐI KHÔNG tự nhắc sếp Winhp nếu khách không nhắc!';
	const prompt = `Mày là "Osin", bot tấu hài trong server Discord "HỘI HÀI DÓN". Người chat: ${ten}. ${thaiDo}\nKhách: "${tin}". Rep lại 1-2 câu ngắn gọn, súc tích!`;

	for (let i = 0; i < 3; i++) {
		try {
			const result = await model.generateContent(prompt);
			return (await result.response).text();
		} catch (err) {
			const code = err.status ?? err.code ?? (err.message?.match(/\b([45]\d\d)\b/)?.[0]) ?? '???';
			if (String(code) === '429' && i < 2) { await sleep(5000); continue; }
			return `Má nó, API Google đang bị kẹt rồi (Mã: ${code}). Chờ 1 phút rồi réo tao lại nha!`;
		}
	}
}

// ─── LỆNH DISCORD ─────────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return;
	const text = message.content.toLowerCase().trim();

	// on/off
	if (text === 'osin off' || text === 'osin on') {
		if (!message.member?.permissions.has('Administrator'))
			return message.reply('Mày tuổi gì đòi rọ mõm tao? Kêu sếp Thắng ra đây!');
		isOsinEnabled = text === 'osin on';
		return message.reply(isOsinEnabled
			? 'Osin đã thức! Đứa nào láo tao tế sống!'
			: 'Đã ngậm mồm! Osin đi ngủ, cấm làm phiền!');
	}

	if (!isOsinEnabled) return;

	// Kiểm tra xem có bị réo không
	let biBoc = text.includes('osin') || message.mentions.has(client.user.id);
	if (!biBoc && message.reference) {
		const ref = await message.fetchReference().catch(() => null);
		if (ref?.author.id === client.user.id) biBoc = true;
	}
	if (!biBoc) return;

	// Cooldown 2s mỗi người
	const now = Date.now();
	const cd  = cooldowns.get(message.author.id);
	if (cd && now < cd + 2000) {
		const conLai = ((cd + 2000 - now) / 1000).toFixed(1);
		return message.reply(`Spam cc à? ${conLai}s nữa quay lại sủa tiếp!`);
	}
	cooldowns.set(message.author.id, now);
	setTimeout(() => cooldowns.delete(message.author.id), 2000);

	let cau = message.content
		.replace(/osin/gi, '')
		.replace(`<@${client.user.id}>`, '')
		.replace(`<@!${client.user.id}>`, '')
		.trim();
	if (!cau || cau.length < 2) cau = 'Tao vừa réo tên mày cho vui. Chửi tao một câu mỏ hỗn vì tội làm phiền!';
	else if (cau.length > 300) return message.reply('Mày viết sớ tế hả? Dưới 300 chữ lẹ lên!');

	await message.channel.sendTyping();
	const ten = message.member?.displayName ?? message.author.username;
	const tra = await osinTraTreo(cau, ten, message.author.id);
	return message.reply({ content: tra, allowedMentions: { repliedUser: false } });
});

// ─── TEMPLATES THÔNG BÁO ──────────────────────────────────────────────────────
const TEMPLATES = {
	ytLive: [
		'🔴 ÉT Ô ÉT! Sếp Winhp đang lên live rắc muối trên YouTube rùi ae ơi! Khum xem đêm nay mất ngủ ráng chịu nha: {url}',
		'🔴 Kèo thơm! Sếp Thắng đang live YouTube gòi. AE vào buff view nhiệt tình cho Osin có tiền mua trà sữa coi: {url}',
		'🔴 Đỉnh nóc kịch trần! Sếp Thắng đang live YouTube, vứt hết deadline vào donate cho sếp lẹ: {url}',
		'🔴 Trầm cảm quá thì làm gì? Lên YouTube xem idol Winhp tấu hề chữa lành nà mấy bácc: {url}',
		'🔴 Ai giải cứu sếp Thắng khỏi sự vô tri này đi!! Sếp đang gào thét trên YouTube kìa, link đây nhấp lẹ: {url}',
	],
	ttLive: [
		'🎵 Ối dồi ôi, idol Winhp đang ngoáy mông trên tóp tóp kìa! AE bơi vào nhấp tim cháy máy cho sếp sướng coi: {url}',
		'🎵 Sếp Thắng đang live tóp tóp làm trò con bò kìa ae ơi, vào xem ổng flex độ vô tri nà: {url}',
		'🎵 Quá ố dề! Sếp Winhp đang múa quạt trên tóp tóp, ae vào spam comment khịa ổng lẹ: {url}',
		'🎵 Sếp Thắng đang live tóp tóp lùa gà!! Nhanh tay vào thả tim kẻo ổng dỗi trừ lương Osin: {url}',
		'🎵 Hội mỏ hỗn điểm danh! Sếp Thắng đang live tóp tóp, ae vào combat bằng tim cho sập live luôn điiii: {url}',
	],
	ytVideo: [
		'📺 Mới ra lò nóng hổi! Sếp Thắng vừa thả siêu phẩm: **{title}**\nKhứa nào khum xem sếp tế sống ráng chịu: {url}',
		'📺 Đỉnh của chóp!! Sếp Winhp vừa up video mới dòi: **{title}**\nCày view lẹ cho sếp mua mồi cho Osin ăn coi: {url}',
		'📺 Chằm zn với content này! Sếp Thắng vừa ra video nhức nách: **{title}**\nBấm vào cày lẹ, khum xem tiếc 10 kiếp: {url}',
		'📺 Ê nhõi, sếp Thắng mới ra clip kìa: **{title}**\nAE bấm vào cày view không là luật hoa quả không chừa ai: {url}',
		'📺 Hào quang rực rỡ! Sếp Thắng vừa nhả video: **{title}**\nVào thẩm lẹ, 10 điểm không có nhưng nàoooo: {url}',
	],
};

const lastPicked = {};
function pickRandom(key) {
	const list = TEMPLATES[key];
	let idx;
	do { idx = Math.floor(Math.random() * list.length); }
	while (list.length > 1 && idx === lastPicked[key]);
	lastPicked[key] = idx;
	return list[idx];
}

// ─── YOUTUBE & TIKTOK WATCHER ─────────────────────────────────────────────────
let cachedYtChannelId, uploadsPlaylistId;
let announcedLiveId, announcedVideoId;
let initYtLive = false, initYtVideo = false;
const announcedLiveIds = new Set();

let initTt = false, wasTtLive = false;
const ttConn = cfg.tiktokAccount
	? new TikTokLiveConnection(
		cfg.tiktokAccount.match(/@([\w.-]+)/)?.[1] ?? cfg.tiktokAccount.replace(/^@/, '').replace(/\/$/, ''),
		{},
	)
	: null;

async function ytApi(endpoint, query) {
	const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
	for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
	url.searchParams.set('key', cfg.youtubeApiKey);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
	return res.json();
}

async function sendMsg(channelId, content, allowedMentions) {
	const ch = await client.channels.fetch(channelId);
	if (ch?.isTextBased()) await ch.send({ content, allowedMentions });
}

// Polling an toàn: dùng setTimeout chain thay vì setInterval → không bị chồng lịch
function startPolling(name, intervalMs, fn) {
	const run = async () => {
		try { await fn(); }
		catch (err) { console.error(`[${name}] Lỗi:`, err.message); }
		finally { setTimeout(run, intervalMs); }
	};
	run();
}

async function checkYouTube() {
	// Resolve channel ID lần đầu
	if (!cachedYtChannelId) {
		const isUc = /(?:youtube\.com\/channel\/)?(UC[\w-]{22})/i.exec(cfg.youtubeChannel);
		const ref  = isUc ? { id: isUc[1] } : { forHandle: cfg.youtubeChannel.replace(/^.*@/, '').replace(/\/$/, '') };
		const data = await ytApi('channels', { part: 'id,contentDetails', ...ref });
		cachedYtChannelId   = data.items?.[0]?.id;
		uploadsPlaylistId   = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
		if (!cachedYtChannelId) throw new Error('Không tìm thấy kênh YouTube.');
	}

	// ── Live ──
	if (cfg.ytLiveChannelId) {
		const data    = await ytApi('search', { part: 'id', channelId: cachedYtChannelId, eventType: 'live', type: 'video', maxResults: '1' });
		const videoId = data.items?.[0]?.id?.videoId;
		if (!initYtLive) {
			announcedLiveId = videoId;
			if (videoId) announcedLiveIds.add(videoId);
			initYtLive = true;
		} else if (videoId && videoId !== announcedLiveId) {
			const url = `https://www.youtube.com/watch?v=${videoId}`;
			await sendMsg(cfg.ytLiveChannelId, `@everyone\n${pickRandom('ytLive').replace('{url}', url)}`, { parse: ['everyone'] });
			announcedLiveId = videoId;
			announcedLiveIds.add(videoId);
			console.log(`[YT Live] Đã thông báo: ${videoId}`);
		} else if (!videoId && announcedLiveId) {
			announcedLiveId = undefined; // Reset khi live kết thúc
		}
	}

	// ── Video mới ──
	if (cfg.ytVideoChannelId) {
		const data    = await ytApi('playlistItems', { part: 'snippet', playlistId: uploadsPlaylistId, maxResults: '1' });
		const item    = data.items?.[0]?.snippet;
		const videoId = item?.resourceId?.videoId;
		if (!initYtVideo) { announcedVideoId = videoId; initYtVideo = true; return; }
		if (!videoId || videoId === announcedVideoId || announcedLiveIds.has(videoId)) return;

		const details = await ytApi('videos', { part: 'snippet,liveStreamingDetails', id: videoId });
		const video   = details.items?.[0];
		if (!video) return;
		// Chỉ thông báo nếu là video thường (không phải live/VOD)
		if (video.snippet?.liveBroadcastContent !== 'none' || video.liveStreamingDetails) {
			announcedVideoId = videoId;
			return;
		}

		const title   = video.snippet.title.replace(/@/g, '@\u200b');
		const url     = `https://www.youtube.com/watch?v=${videoId}`;
		const mention = cfg.ytVideoRoleId ? `<@&${cfg.ytVideoRoleId}> ` : '@everyone ';
		const msg     = pickRandom('ytVideo').replace('{title}', title).replace('{url}', url);
		await sendMsg(cfg.ytVideoChannelId, `${mention}${msg}`, {
			parse: cfg.ytVideoRoleId ? [] : ['everyone'],
			roles: cfg.ytVideoRoleId ? [cfg.ytVideoRoleId] : [],
		});
		announcedVideoId = videoId;
		console.log(`[YT Video] Đã thông báo: ${title}`);
	}
}

async function checkTikTok() {
	if (!ttConn) return;
	const isLive = await ttConn.fetchIsLive();
	if (!initTt) { wasTtLive = isLive; initTt = true; return; }
	if (isLive && !wasTtLive) {
		const user = cfg.tiktokAccount.match(/@([\w.-]+)/)?.[1] ?? cfg.tiktokAccount.replace(/^@/, '').replace(/\/$/, '');
		const url  = `https://www.tiktok.com/@${user}/live`;
		await sendMsg(cfg.ttLiveChannelId, `@everyone\n${pickRandom('ttLive').replace('{url}', url)}`, { parse: ['everyone'] });
		console.log(`[TikTok Live] Đã thông báo: ${user}`);
	}
	wasTtLive = isLive;
}

// ─── KHỞI ĐỘNG ────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, (rc) => {
	console.log(`✅ Bot online: ${rc.user.tag}`);
	if (cfg.youtubeApiKey && cfg.youtubeChannel && (cfg.ytLiveChannelId || cfg.ytVideoChannelId))
		startPolling('YouTube', cfg.youtubePollMs, checkYouTube);
	if (cfg.tiktokAccount && cfg.ttLiveChannelId)
		startPolling('TikTok', cfg.tiktokPollMs, checkTikTok);
});

client.login(cfg.discordToken);
