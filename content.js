function getElementByXPath(xpath, doc) {
  const evaluator = new XPathEvaluator();
  const result = evaluator.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

function createListText(end, price, data) {
  let list = '<div class="productPurchase__list">';
  for (let i = 0; i < end; i++) {
    list += `<div class="productPurchase__listItem"><dt>${i+1}巻</dt><dd class=${data[i].isNew ? "list_new_price_ex" : "list_old_price_ex"}>¥<span>${price[i]}</span></dd></div>`;
  }
  list += "</div>";
  return list;
}

function calcTotalPrice(end, price) {
  let totalPrice = 0;
  
  for (let i = 0; i < end; i++) {
    totalPrice += price[i];
  }

  totalPrice = Math.round(totalPrice / 100) * 100;

  return totalPrice.toLocaleString();
}

function changeTotalPrice(value, price, data) {
  const totalPrice = calcTotalPrice(value, price);
  const targetElement = document.querySelector('.list_item_ex');
  const listText = createListText(value, price, data);
  const listElement = document.createElement('div');
  listElement.innerHTML = listText;

  const totalPriceElement = document.querySelector('.calc_total_price_ex');
  if (totalPriceElement) {
    totalPriceElement.textContent = "¥" + totalPrice;
  }
  if (targetElement) {
    targetElement.replaceChild(listElement, targetElement.lastChild);
  } 
}

const url = window.location.href;

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

      const totalPrice = calcTotalPrice(totalCount, transformedPrices);

      const targetXpath = '//*[@id="pbBlock40906"]/div[2]/div[2]';
      const targetElement = getElementByXPath(targetXpath, document);

      const totalPriceElement = document.createElement('div');
      const listElement = createListText(totalCount, transformedPrices, data);
      totalPriceElement.innerHTML = `
        <div class="productPurchase__total">
          <div>
            <input id="volumeInput" type="number" min="1" max=${totalCount} value=${totalCount} />
            巻まで
          </div>
          <div class="productPurchase__list">
            <div class="productPurchase__listItem">
              <dt>セット金額：</dt>
              <dd><span class="calc_total_price_ex">¥${totalPrice}</span></dd>
            </div>
          </div>
          <div class="productPurchase__list">
            <div class="productPurchase__listItem">
              <dt>巻数</dt>
              <dd>中古金額</dd>
            </div>
          </div>
          <div class="list_item_ex">${listElement}</div>
        </div>
      `;

      if (targetElement) {
        targetElement.appendChild(totalPriceElement);

        const inputElement = document.getElementById('volumeInput');
        inputElement.addEventListener('change', function() {
          changeTotalPrice(this.value, transformedPrices, data);
        });
      } else {
        console.log("Target element not found");
      }
    } else {
      console.log("Element not found");
    }
  }
});
