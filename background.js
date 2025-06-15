// Hàm gọi Gemini API
async function callGeminiAPI(text, taskType, targetLang = 'en', apiKey) {
    if (!apiKey) {
        return { success: false, error: "API Key chưa được cấu hình. Vui lòng vào cài đặt tiện ích để thêm API Key.", actionType: taskType };
    }

    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    let promptText;
    if (taskType === "ASK_GEMINI") {
        promptText = `Hãy cho tôi biết ${text} là gì`; 
    } else if (taskType === "TRANSLATE_GEMINI") {
        promptText = `Dịch đoạn văn bản sau sang tiếng ${targetLang} một cách chính xác và tự nhiên nhất. Chỉ trả về nội dung đã dịch, không thêm bất kỳ lời giải thích hay ghi chú nào:\n\n"${text}"`;
    } else {
        return { success: false, error: "Loại tác vụ không hợp lệ.", actionType: taskType };
    }

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    // temperature: 0.7, // Điều chỉnh nếu cần
                    // maxOutputTokens: 1000, // Điều chỉnh nếu cần
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error Response:", errorData);
            let errorMessage = `Lỗi API: ${response.statusText}`;
            if (errorData.error && errorData.error.message) {
                errorMessage = `Lỗi API: ${errorData.error.message}`;
            }
            return { success: false, error: errorMessage, actionType: taskType };
        }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0) {
            return { success: true, data: data.candidates[0].content.parts[0].text, actionType: taskType };
        } else {
            // Kiểm tra phản hồi chặn từ API
            if (data.promptFeedback && data.promptFeedback.blockReason) {
                 return { success: false, error: `Yêu cầu bị chặn bởi API: ${data.promptFeedback.blockReason}`, actionType: taskType };
            }
            if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === "SAFETY") {
                return { success: false, error: "Yêu cầu bị chặn vì lý do an toàn nội dung.", actionType: taskType };
            }
            console.warn("Gemini API - No content in response:", data);
            return { success: false, error: "Không có nội dung trả về từ AI hoặc định dạng phản hồi không đúng.", actionType: taskType };
        }

    } catch (error) {
        console.error("Lỗi khi gọi Gemini API:", error);
        return { success: false, error: `Lỗi kết nối hoặc xử lý: ${error.message}`, actionType: taskType };
    }
}

// Lắng nghe tin nhắn từ content.js hoặc popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "ASK_GEMINI" || request.type === "TRANSLATE_GEMINI") {
        chrome.storage.local.get('geminiApiKey', async (result) => {
            const apiKey = result.geminiApiKey;
            const response = await callGeminiAPI(request.text, request.type, request.targetLang, apiKey);
            sendResponse(response);
        });
        return true; //  Will respond asynchronously.
    } else if (request.type === "SAVE_API_KEY") {
        chrome.storage.local.set({ geminiApiKey: request.apiKey }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, message: `Lỗi khi lưu API Key: ${chrome.runtime.lastError.message}` });
            } else {
                sendResponse({ success: true, message: "Đã lưu API Key." });
            }
        });
        return true; // Will respond asynchronously.
    } else if (request.type === "GET_API_KEY") {
        chrome.storage.local.get('geminiApiKey', (result) => {
            if (chrome.runtime.lastError) {
                 sendResponse({ success: false, apiKey: null, message: `Lỗi khi lấy API Key: ${chrome.runtime.lastError.message}` });
            } else {
                sendResponse({ success: true, apiKey: result.geminiApiKey });
            }
        });
        return true; // Will respond asynchronously.
    }
    return false; // If no async response is needed
});


// --- Context Menu (Menu chuột phải) ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "askGeminiContextMenu",
        title: "Hỏi Gemini về '%s'", // %s là văn bản được chọn
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "translateGeminiContextMenu",
        title: "Dịch '%s' với Gemini (sang Tiếng Việt)",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.id) {
        console.error("Context menu clicked without a valid tab.");
        return;
    }
    if (!info.selectionText) return;

    const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
    let taskType = "";
    let title = "";

    if (info.menuItemId === "askGeminiContextMenu") {
        taskType = "ASK_GEMINI";
        title = "Kết quả từ AI Gemini (Menu):";
    } else if (info.menuItemId === "translateGeminiContextMenu") {
        taskType = "TRANSLATE_GEMINI";
        title = "Bản dịch (Menu):";
    } else {
        return;
    }

    // Gửi tin nhắn yêu cầu hiển thị loading tới content script
    try {
        await chrome.tabs.sendMessage(tab.id, {
            type: "SHOW_GEMINI_RESULT_FROM_CONTEXT_MENU",
            title: `Đang xử lý "${info.menuItemId === "askGeminiContextMenu" ? "Hỏi AI" : "Dịch"}"...`,
            success: true, // Tạm thời, sẽ được cập nhật sau
            data: "<div class='gth-spinner'></div>", // Hiển thị spinner
            error: null,
            actionType: taskType,
            isLoading: true // Báo cho content script biết là đang tải
        });
    } catch (e) {
        console.warn("Could not send loading message to content script (it might not be ready or injected):", e);
        // Tiếp tục xử lý API call, kết quả có thể không hiển thị nếu content script không nhận được
    }


    const response = await callGeminiAPI(info.selectionText, taskType, "Vietnamese", geminiApiKey);

    // Gửi kết quả cuối cùng tới content script
    try {
        await chrome.tabs.sendMessage(tab.id, {
            type: "SHOW_GEMINI_RESULT_FROM_CONTEXT_MENU",
            title: title,
            success: response.success,
            data: response.data,
            error: response.error,
            actionType: taskType,
            isLoading: false
        });
    } catch (e) {
        console.error("Error sending final result to content script:", e);
        // Nếu content script không nhận được, ít nhất lỗi cũng đã được log ở background
    }
});