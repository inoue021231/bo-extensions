function getElementByXPath(xpath, doc) {
  const evaluator = new XPathEvaluator();
  const result = evaluator.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

const url = window.location.href;
const start = 1;
const end = 10;

chrome.runtime.sendMessage({
  type: "fetchPage",
  url
}, (targetPageResponse) => {
  if (targetPageResponse.success) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(targetPageResponse.data, "text/html");

    const data = [];

    const totalCountXpath = '//*[@id="pbBlock40906"]/div[1]/div[1]/div/section/div/p[2]/strong';
    const totalCountElement = getElementByXPath(totalCountXpath, doc);

    if (totalCountElement) {
      const text = totalCountElement.textContent;
      const totalCount = parseInt(text.match(/全(\d+)点/)[1], 10);

      for (let i = 1; i <= totalCount; i++) {
        const priceXpath = `//*[@id="productSetItemsTab${parseInt((i - 1) / 20) * 20 + 1}"]/div[${(i - 1) % 20 + 1}]/div/div[4]/p`;
        const genreXpath = `//*[@id="productSetItemsTab${parseInt((i - 1) / 20) * 20 + 1}"]/div[${(i - 1) % 20 + 1}]/div/div[3]/div/ul/li[2]`;
        const priceElement = getElementByXPath(priceXpath, doc);
        const genreElement = getElementByXPath(genreXpath, doc);

        if (priceElement) {
          const prePrice = priceElement.textContent;
          const price = parseInt(prePrice.replace("¥", ""));
          const genre = genreElement.textContent;
          data.push({
            price,
            isNew: genre === "新品"
          });
        }
      }

      function findNearestFalseIndex(data, startIndex, direction) {
        let index = startIndex;
        while (index >= 0 && index < data.length) {
          if (data[index].isNew === false) {
            return index;
          }
          index += direction; // 前方向なら-1、後方向なら+1
        }
        return null;
      }

      const transformedPrices = data.map((item, i) => {
        if (!item.isNew) {
          return item.price;
        }

        // 前方の isNew が false の要素を探す
        const prevIndex = findNearestFalseIndex(data, i - 1, -1);
        // 後方の isNew が false の要素を探す
        const nextIndex = findNearestFalseIndex(data, i + 1, 1);

        let newPrice;

        if (prevIndex !== null && nextIndex !== null) {
          // 前後の isNew = false の要素が見つかった場合、その平均を取る
          newPrice = (data[prevIndex].price + data[nextIndex].price) / 2;
        } else if (prevIndex !== null) {
          // 前方だけ見つかった場合、その値を使う
          newPrice = data[prevIndex].price;
        } else if (nextIndex !== null) {
          // 後方だけ見つかった場合、その値を使う
          newPrice = data[nextIndex].price;
        } else {
          // 前後ともに見つからない場合は半額にする
          newPrice = item.price / 2;
        }

        return newPrice;
      });

      let totalPrice = 0;
      for (let i = start - 1; i < totalCount; i++) {
        totalPrice += transformedPrices[i];
      }

      const formattedTotalPrice = totalPrice.toLocaleString();

      const targetXpath = '//*[@id="pbBlock40906"]/div[2]/div[2]';
      const targetElement = getElementByXPath(targetXpath, document);

      const totalPriceElement = document.createElement('div');
      totalPriceElement.innerHTML = `
        <div class="productPurchase__listItem">
          <dt>セット金額：</dt>
          <dd>¥<span class="calc_total_price">${formattedTotalPrice}</span></dd>
        </div>
      `;

      if (targetElement) {
        targetElement.appendChild(totalPriceElement);
      } else {
        console.log("Target element not found");
      }
    } else {
      console.log("Element not found");
    }
  }
});
