chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "fetchPage") {
    fetch(request.url)
      .then(response => response.text())
      .then(htmlString => {
        sendResponse({ success: true, data: htmlString });
      })
      .catch(error => {
        console.error("Error fetching target URL:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});