// popup.js (JavaScript cho popup.html)
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Hàm hiển thị thông báo
    function showStatus(message, isSuccess) {
        statusDiv.textContent = message;
        statusDiv.className = isSuccess ? 'success' : 'error';
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 3000); // Xóa thông báo sau 3 giây
    }

    // Tải API key đã lưu (nếu có) khi mở popup
    chrome.runtime.sendMessage({ type: "GET_API_KEY" }, (response) => {
        if (response) {
            if (response.success && response.apiKey) {
                apiKeyInput.value = response.apiKey;
            } else if (!response.success && response.message) {
                 showStatus(response.message, false);
            }
        } else {
            showStatus("Không thể kết nối với background script.", false);
        }
    });

    // Xử lý sự kiện click nút Lưu
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.runtime.sendMessage({ type: "SAVE_API_KEY", apiKey: apiKey }, (response) => {
                if (response) {
                    showStatus(response.message, response.success);
                } else {
                     showStatus("Không nhận được phản hồi khi lưu API Key.", false);
                }
            });
        } else {
            showStatus("Vui lòng nhập API Key.", false);
        }
    });
});