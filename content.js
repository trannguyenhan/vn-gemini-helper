// content.js

let actionPopup = null;
let resultPopup = null;

function showActionPopup(x, y, selectedText) {
    // console.log('[Gemini Helper] showActionPopup attempting for text:', selectedText, 'at raw x:', x, 'y:', y);
    hideActionPopup(); // Luôn ẩn popup cũ trước khi hiển thị cái mới

    actionPopup = document.createElement('div');
    actionPopup.id = 'gemini-text-helper-action-popup';

    // Ước lượng kích thước của popup (có thể cần điều chỉnh dựa trên CSS thực tế)
    const popupWidth = 230; // Chiều rộng ước tính của popup
    const popupHeight = 50;  // Chiều cao ước tính của popup

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Khoảng cách mong muốn từ con trỏ chuột
    const offsetX = 15; // Cách con trỏ 15px về bên phải
    const offsetY = 15; // Cách con trỏ 15px về phía dưới

    // Tính toán vị trí ban đầu (ưu tiên dưới-phải con trỏ)
    let finalLeft = x + offsetX;
    let finalTop = y + offsetY;

    // 1. Kiểm tra và điều chỉnh nếu popup vượt ra ngoài cạnh phải của viewport
    if (finalLeft + popupWidth > viewportWidth) {
        // Nếu không đủ không gian bên phải, thử hiển thị bên trái con trỏ
        finalLeft = x - popupWidth - offsetX;
    }

    // 2. Kiểm tra và điều chỉnh nếu popup vượt ra ngoài cạnh dưới của viewport
    if (finalTop + popupHeight > viewportHeight) {
        // Nếu không đủ không gian bên dưới, thử hiển thị phía trên con trỏ
        finalTop = y - popupHeight - offsetY;
    }

    // 3. Sau khi có thể đã lật vị trí, đảm bảo popup không vượt ra ngoài cạnh trái viewport
    if (finalLeft < 5) { // 5px là khoảng đệm nhỏ
        finalLeft = 5;
    }

    // 4. Đảm bảo popup không vượt ra ngoài cạnh trên viewport
    if (finalTop < 5) { // 5px là khoảng đệm nhỏ
        finalTop = 5;
    }

    // 5. Các kiểm tra cuối cùng nếu popup vẫn lớn hơn không gian còn lại (trường hợp hiếm)
    // Ví dụ: màn hình quá nhỏ hoặc popup quá lớn
    if (finalLeft + popupWidth > viewportWidth - 5) {
        finalLeft = viewportWidth - popupWidth - 5;
        if (finalLeft < 5) finalLeft = 5; // Đảm bảo không bị đẩy sang trái quá mức
    }
    if (finalTop + popupHeight > viewportHeight - 5) {
        finalTop = viewportHeight - popupHeight - 5;
        if (finalTop < 5) finalTop = 5; // Đảm bảo không bị đẩy lên trên quá mức
    }
    
    // console.log('[Gemini Helper] Calculated position - finalLeft:', finalLeft, 'finalTop:', finalTop);

    actionPopup.style.left = `${finalLeft}px`;
    actionPopup.style.top = `${finalTop}px`;

    const askAIButton = document.createElement('button');
    askAIButton.textContent = 'Hỏi AI Gemini';
    askAIButton.addEventListener('click', () => {
        const currentSelection = window.getSelection().toString().trim();
        // console.log('[Gemini Helper] Ask AI button clicked, selected text:', currentSelection);
        if (currentSelection) {
            showResultPopup("Đang hỏi AI...", true);
            chrome.runtime.sendMessage({ type: "ASK_GEMINI", text: currentSelection }, handleResponse);
        }
        hideActionPopup();
    });

    const translateButton = document.createElement('button');
    translateButton.textContent = 'Dịch';
    translateButton.addEventListener('click', () => {
        const currentSelection = window.getSelection().toString().trim();
        // console.log('[Gemini Helper] Translate button clicked, selected text:', currentSelection);
        if (currentSelection) {
            showResultPopup("Đang dịch...", true);
            chrome.runtime.sendMessage({ type: "TRANSLATE_GEMINI", text: currentSelection, targetLang: "Vietnamese" }, handleResponse);
        }
        hideActionPopup();
    });

    actionPopup.appendChild(askAIButton);
    actionPopup.appendChild(translateButton);
    document.body.appendChild(actionPopup);
}

function hideActionPopup() {
    if (actionPopup) {
        // console.log('[Gemini Helper] hideActionPopup called');
        actionPopup.remove();
        actionPopup = null;
    }
}

function showResultPopup(titleText, isLoading = false) {
    // console.log('[Gemini Helper] showResultPopup called, title:', titleText, 'isLoading:', isLoading);
    hideResultPopup();

    resultPopup = document.createElement('div');
    resultPopup.id = 'gemini-text-helper-result-popup';

    const header = document.createElement('div');
    header.id = 'gemini-text-helper-result-popup-header';

    const title = document.createElement('h3');
    title.textContent = titleText;

    const closeButton = document.createElement('button');
    closeButton.id = 'gemini-text-helper-result-popup-close-btn';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', hideResultPopup);

    header.appendChild(title);
    header.appendChild(closeButton);

    const content = document.createElement('div');
    content.id = 'gemini-text-helper-result-popup-content';
    if (isLoading) {
        content.classList.add('loading');
        const spinner = document.createElement('div');
        spinner.className = 'gth-spinner';
        content.appendChild(spinner);
    }

    resultPopup.appendChild(header);
    resultPopup.appendChild(content);
    document.body.appendChild(resultPopup);
}

function hideResultPopup() {
    if (resultPopup) {
        // console.log('[Gemini Helper] hideResultPopup called');
        resultPopup.remove();
        resultPopup = null;
    }
}

function handleResponse(response) {
    // console.log('[Gemini Helper] handleResponse called with:', response);
    const contentDiv = document.getElementById('gemini-text-helper-result-popup-content');
    const titleH3 = document.querySelector('#gemini-text-helper-result-popup-header h3');

    if (!contentDiv || !titleH3) {
        if (response && response.error) {
            console.error("[Gemini Helper] Error (result popup DOM not found):", response.error);
        }
        return;
    }
    
    contentDiv.classList.remove('loading');
    const spinner = contentDiv.querySelector('.gth-spinner');
    if(spinner) spinner.remove();

    if (response && response.success && response.data) {
        contentDiv.textContent = response.data;
        if (response.actionType === "ASK_GEMINI") {
            titleH3.textContent = "Kết quả từ AI Gemini:";
        } else if (response.actionType === "TRANSLATE_GEMINI") {
            titleH3.textContent = "Bản dịch:";
        }
    } else if (response && response.error) {
        contentDiv.textContent = `Lỗi: ${response.error}`;
        titleH3.textContent = "Lỗi";
    } else {
        contentDiv.textContent = "Không nhận được phản hồi hoặc có lỗi không xác định.";
        titleH3.textContent = "Lỗi";
    }
}


// Mousedown listener
document.addEventListener('mousedown', (event) => {
    // console.log('[Gemini Helper] mousedown detected on target:', event.target);
    if (event.target.closest('#gemini-text-helper-action-popup button')) {
        // console.log('[Gemini Helper] mousedown on action button, returning.');
        return;
    }
    if (event.target.closest('#gemini-text-helper-result-popup-close-btn')) {
        // console.log('[Gemini Helper] mousedown on result close button, returning.');
        return;
    }

    if (actionPopup && !actionPopup.contains(event.target)) {
        // console.log('[Gemini Helper] mousedown outside actionPopup, hiding it.');
        hideActionPopup();
    }

    if (resultPopup && !resultPopup.contains(event.target)) {
        // console.log('[Gemini Helper] mousedown outside resultPopup, hiding it.');
        hideResultPopup();
    }
});

// Mouseup listener
document.addEventListener('mouseup', (event) => {
    // console.log('[Gemini Helper] mouseup detected on target:', event.target, 'at x:', event.clientX, 'y:', event.clientY);

    if (event.target.closest('#gemini-text-helper-action-popup button')) {
        // console.log('[Gemini Helper] mouseup on action button, returning.');
        return;
    }
    if (resultPopup && resultPopup.contains(event.target)) {
        // console.log('[Gemini Helper] mouseup inside resultPopup, returning.');
        return;
    }
    if (actionPopup && actionPopup.contains(event.target)) {
        // console.log('[Gemini Helper] mouseup inside actionPopup (not button), letting setTimeout handle.');
    }

    setTimeout(() => {
        const rawSelection = window.getSelection();
        // console.log('[Gemini Helper] setTimeout - raw selection object:', rawSelection);
        // console.log('[Gemini Helper] setTimeout - raw selection text:', rawSelection.toString());
        
        const selectedText = rawSelection.toString().trim();
        // console.log('[Gemini Helper] setTimeout - trimmed selectedText:', selectedText, '| length:', selectedText.length);
        
        const activeEl = document.activeElement;
        let isSelectionInEditableField = false;
        // console.log('[Gemini Helper] setTimeout - activeElement:', activeEl ? activeEl.tagName : 'null');

        if (activeEl) {
            const tagName = activeEl.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || activeEl.isContentEditable) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (activeEl.contains(range.commonAncestorContainer)) {
                        isSelectionInEditableField = true;
                        // console.log('[Gemini Helper] setTimeout - Selection IS in an editable field.');
                    }
                }
            }
        }
        // if (!isSelectionInEditableField) {
        //     console.log('[Gemini Helper] setTimeout - Selection is NOT in an editable field.');
        // }

        if (selectedText && selectedText.length > 0 && !isSelectionInEditableField) {
            // console.log('[Gemini Helper] setTimeout - Condition MET to show action popup.');
            // Truyền event.clientX và event.clientY từ sự kiện mouseup gốc
            showActionPopup(event.clientX, event.clientY, selectedText);
        } else {
            // console.log('[Gemini Helper] setTimeout - Condition NOT MET to show action popup. Hiding if any.');
            hideActionPopup();
        }
    }, 0);
});

// Lắng nghe tin nhắn từ background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log('[Gemini Helper] Message received from background:', request);
    if (request.type === "SHOW_GEMINI_RESULT_FROM_CONTEXT_MENU") {
        if (resultPopup) {
            hideResultPopup();
        }
        showResultPopup(request.title || "Kết quả:", request.isLoading);
        if (!request.isLoading) {
            handleResponse({
                success: request.success,
                data: request.data,
                error: request.error,
                actionType: request.actionType
            });
        }
        sendResponse({ status: "Result display process initiated in content script" });
    }
    return true;
});

// console.log('[Gemini Helper] Content script loaded and listeners attached.');