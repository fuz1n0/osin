import { createHealthServer } from './health-server.js';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Đã chuyển sang dùng import chuẩn chỉ

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

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

// ==========================================
// KHỞI TẠO BỘ NÃO GEMINI CHO OSIN
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" }); // Sửa lại thành 1.5-flash

let isOsinEnabled = true;

async function osinTraTreo(tinNhanCuaKhach) {
    try {
        const thanChú = `
        Mày là 'Osin', một con bot tấu hài trong server Discord 'HỘI HÀI DÓN' của sếp Winhp (Thắng đi rừng). 
        Tính cách của mày: mỏ hỗn, bẩn bựa, hay cà khịa, chửi thề sương sương kiểu game thủ LOL, nhưng luôn bênh vực sếp Winhp.
        Trang bị vốn từ GenZ, toxic nhẹ nhưng mang tính tấu hài là chính.
        Bây giờ khách trong server chat câu này, mày rep lại nó thật thâm thúy ngắn gọn cho tao: 
        "${tinNhanCuaKhach}"
        `;
        const result = await model.generateContent(thanChú);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Lỗi Google API:", error);
        return "Lag não cmnr sếp ơi, API Google đang đi ẻ, chờ xíu phán tiếp!";
    }
}

// ==========================================
// XỬ LÝ LỆNH CHAT VÀ GỌI OSIN
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const noiDung = message.content.toLowerCase().trim();

    // 1. Công tắc rọ mõm (Chỉ Admin)
    if (noiDung === 'osin off' || noiDung === 'osin on') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('Mày tuổi gì đòi rọ mõm tao? Kêu sếp Thắng ra đây nói chuyện!');
        }

        if (noiDung === 'osin off') {
            isOsinEnabled = false;
            return message.reply('Đã ngậm mồm! Osin đi ngủ đây, cấm đứa nào làm phiền!');
        } else {
            isOsinEnabled = true;
            return message.reply('Osin đã thức giấc! Đứa nào láo nháo tao tế sống!');
        }
    }

    // 2. Chửi lộn khi bị réo tên HOẶC bị Reply
    if (!isOsinEnabled) return;

    // Xác định xem bot có đang bị réo không (có chữ "osin" hoặc bị Tag thẳng mặt)
    let biReo = noiDung.includes('osin') || message.mentions.has(client.user.id);

    // Cực kỳ quan trọng: Nếu khách không gọi "osin", không tag, NHƯNG bấm nút Reply tin nhắn của bot
    if (!biReo && message.reference) {
        const tinNhanGoc = await message.fetchReference().catch(() => null);
        // Nếu tin nhắn gốc đúng là của con Osin thì tính là đang bị réo
        if (tinNhanGoc && tinNhanGoc.author.id === client.user.id) {
            biReo = true; 
        }
    }

    if (biReo) {
        // Lọc bỏ chữ "osin" và cái tag ID của bot ra để AI đọc câu hỏi không bị lú
        const cauHoi = message.content
            .replace(/osin/gi, '')
            .replace(`<@${client.user.id}>`, '')
            .replace(`<@!${client.user.id}>`, '')
            .trim();

        if (!cauHoi) {
            return message.reply('Mày réo tên tao rồi để đấy à? Rảnh háng hả?');
        }

        await message.channel.sendTyping();
        const cauTraLoi = await osinTraTreo(cauHoi);
        return message.reply({
            content: cauTraLoi,
            allowedMentions: { repliedUser: false } // Tắt ping để khỏi réo ồn ào sếp Thắng
        });
    }
});

// ==========================================
// SERVER GIỮ MẠNG (HEALTH SERVER)
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
// THÔNG BÁO LIVE VÀ VIDEO YT / TIKTOK
// ==========================================
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Bot đã online: ${readyClient.user.tag}`);
	startConfiguredWatchers();
});

function startPolling(name, intervalMs, check) {
	const run = async () => {
		try {
			await check();
		} catch (error) {
			console.error(`[${name}] Lỗi kiểm tra:`, error);
			const causes = error?.config?.requestErrs;
			if (Array.isArray(causes) && causes.length > 0) {
				console.error(
					`[${name}] Lỗi từ các nguồn dự phòng:\n${causes
						.map((cause) => cause?.stack ?? String(cause))
						.join('\n')}`,
				);
			}
		} finally {
			setTimeout(run, intervalMs);
		}
	};
	void run();
}

function startConfiguredWatchers() {
	if (
		config.youtubeApiKey &&
		config.youtubeChannel &&
		(config.youtubeNotificationChannelId || config.youtubeVideoNotificationChannelId)
	) {
		if (!config.youtubeVideoNotificationChannelId) {
			console.log('Thông báo video YouTube đang tắt: hãy cấu hình YOUTUBE_VIDEO_NOTIFICATION_CHANNEL_ID.');
		}
		startPolling('YouTube', config.youtubePollIntervalMs, checkYouTube);
	}

	if (config.tiktokAccount && config.tiktokNotificationChannelId) {
		startPolling('TikTok', config.tiktokPollIntervalMs, checkTikTokLive);
	}
}

async function postLiveAlert(platform, channelId, url) {
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased() || !channel.send) return;

	const templates = platform === 'YouTube'
		? ['🔴 OI OI, rạp xiếc trung ương WINHP chính thức mở cửa trên YouTube! Vào mua vé lẹ: {url}']
		: ['🎵 OI OI, sếp Thắng đang ngoáy trên tóp tóp kìa ae, vào thả tim sập live đi: {url}'];
	
	const message = `@everyone\n${pickRandomTemplate(platform, templates).replace('{url}', url)}`;

	await channel.send({ content: message, allowedMentions: { parse: ['everyone'] } });
	console.log(`[${platform}] Đã gửi thông báo live.`);
}

const lastLiveTemplateIndexes = new Map();
const lastVideoTemplateIndexes = new Map();

function pickRandomTemplate(key, templates, previousIndexes = lastLiveTemplateIndexes) {
	let index = Math.floor(Math.random() * templates.length);
	previousIndexes.set(key, index);
	return templates[index];
}

async function postYoutubeVideoAlert(title, videoId) {
	const channelId = config.youtubeVideoNotificationChannelId;
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased() || !channel.send) return;

	const safeTitle = title.replace(/@/g, '@\u200b');
	const roleMention = config.youtubeVideoNotificationRoleId ? `<@&${config.youtubeVideoNotificationRoleId}> ` : '@everyone ';
	
	await channel.send({
		content: `${roleMention}📺 Alo alo! Sếp Thắng vừa thả hàng mới lên YouTube rồi đó bà con: **${safeTitle}**\nhttps://www.youtube.com/watch?v=${videoId}`,
		allowedMentions: { parse: config.youtubeVideoNotificationRoleId ? [] : ['everyone'], roles: config.youtubeVideoNotificationRoleId ? [config.youtubeVideoNotificationRoleId] : [] },
	});
}

function youtubeChannelReference(value) {
	const channelIdMatch = value.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{22})/i);
	if (channelIdMatch) return { channelId: channelIdMatch[1] };
	const handleMatch = value.match(/@([\w.-]+)/);
	if (handleMatch) return { handle: handleMatch[1] };
	return value.trim().replace(/^@/, '') ? { handle: value.trim().replace(/^@/, '') } : null;
}

async function youtubeApiRequest(params) {
	const url = new URL('https://www.googleapis.com/youtube/v3/' + params.endpoint);
	for (const [key, value] of Object.entries(params.query)) url.searchParams.set(key, value);
	url.searchParams.set('key', config.youtubeApiKey);

	const response = await fetch(url);
	if (!response.ok) throw new Error(`YouTube API trả về HTTP ${response.status}.`);
	return response.json();
}

let cachedYoutubeChannelId;
let youtubeUploadsPlaylistId;
let announcedYoutubeLiveId;
let announcedYoutubeUploadId;
let initializedYoutubeVideos = false;
const announcedYoutubeLiveIds = new Set();

async function ensureYoutubeChannel() {
	if (!cachedYoutubeChannelId) {
		const reference = youtubeChannelReference(config.youtubeChannel);
		const query = { part: 'id,contentDetails' };
		if (reference.channelId) query.id = reference.channelId;
		else query.forHandle = reference.handle;

		const data = await youtubeApiRequest({ endpoint: 'channels', query });
		cachedYoutubeChannelId = data.items?.[0]?.id;
		youtubeUploadsPlaylistId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
	}
}

async function checkYouTubeLive() {
	if (!config.youtubeNotificationChannelId) return;
	const data = await youtubeApiRequest({
		endpoint: 'search',
		query: { part: 'id', channelId: cachedYoutubeChannelId, eventType: 'live', type: 'video', maxResults: '1' },
	});
	const videoId = data.items?.[0]?.id?.videoId;

	if (!videoId || videoId === announcedYoutubeLiveId) return;
	await postLiveAlert('YouTube', config.youtubeNotificationChannelId, `https://www.youtube.com/watch?v=${videoId}`);
	announcedYoutubeLiveId = videoId;
	announcedYoutubeLiveIds.add(videoId);
}

async function checkYouTubeVideos() {
	if (!config.youtubeVideoNotificationChannelId) return;
	const data = await youtubeApiRequest({
		endpoint: 'playlistItems',
		query: { part: 'snippet', playlistId: youtubeUploadsPlaylistId, maxResults: '1' },
	});
	const latestVideo = data.items?.[0]?.snippet;
	const videoId = latestVideo?.resourceId?.videoId;

	if (!initializedYoutubeVideos) {
		announcedYoutubeUploadId = videoId;
		initializedYoutubeVideos = true;
		return;
	}
	if (!videoId || videoId === announcedYoutubeUploadId || announcedYoutubeLiveIds.has(videoId)) return;

	const details = await youtubeApiRequest({ endpoint: 'videos', query: { part: 'snippet,liveStreamingDetails', id: videoId } });
	const video = details.items?.[0];

	if (video?.snippet?.liveBroadcastContent !== 'none' || video?.liveStreamingDetails) return;

	await postYoutubeVideoAlert(video.snippet?.title ?? 'Video mới', videoId);
	announcedYoutubeUploadId = videoId;
}

async function checkYouTube() {
	await ensureYoutubeChannel();
	await checkYouTubeLive();
	await checkYouTubeVideos();
}

function tiktokUsername(value) {
	return (value.match(/@([\w.-]+)/)?.[1] ?? value.trim().replace(/^@/, '')).replace(/\/$/, '');
}

const tiktokConnection = config.tiktokAccount ? new TikTokLiveConnection(tiktokUsername(config.tiktokAccount), {}) : null;
let wasTikTokLive = false;

async function checkTikTokLive() {
	if (!tiktokConnection) return;
	const isLive = await tiktokConnection.fetchIsLive();
	if (isLive && !wasTikTokLive) {
		await postLiveAlert('TikTok', config.tiktokNotificationChannelId, `https://www.tiktok.com/@${tiktokUsername(config.tiktokAccount)}/live`);
	}
	wasTikTokLive = isLive;
}

client.login(config.discordToken);