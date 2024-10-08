/** @type {HTMLScriptElement} */
let $settings

// Get initial config and inject it and the main script into the Twitter page
chrome.storage.local.get((/** @type {Partial<import("./types").Config>} */ storedConfig) => {
  // Update deprecated config values
  // @ts-ignore
  if (storedConfig.twitterBlueChecks == 'dim') {
    storedConfig.twitterBlueChecks = 'replace'
  }

  $settings = document.createElement('script')
  $settings.type = 'text/json'
  $settings.id = 'tnt_settings'
  document.documentElement.appendChild($settings)
  $settings.innerText = JSON.stringify(storedConfig)

  let $main = document.createElement('script')
  $main.src = chrome.runtime.getURL('script.js')
  $main.onload = function() {
    this.remove()
  }
  document.documentElement.appendChild($main)

  chrome.storage.onChanged.addListener(onConfigChange)
})

window.addEventListener("message", (event) => {
  // TODO verify window or origin?
  // if (event.source !== window) return; // Игнорируем другие сообщения

  if (event.data.action && event.data.action === "sendData") {
    console.log("event message", event.data.action)

    // Получаем данные
    const data = event.data.tweet;
    console.log('Received data from script.js:', data);
    // console.log('tabId', chrome.runtime.id)

    // const tabId = chrome.runtime.id;

    try{
      console.log(localStorage.getItem('accounts_to_track'))
      let accounts_to_track = JSON.parse(localStorage.getItem('accounts_to_track') ?? '[]')
      console.log("accounts_to_track", accounts_to_track, data)
      if (accounts_to_track.includes(data.tweetInfo.user)) {
        console.log("save tweet from tracked account", data)
        chrome.runtime.sendMessage({
          action: "processData",
          tweet_url: data.tweetLink ??  window.location.href,
          data: data.tweetInfo,
          tabId: null
        });
        return;
      }
    }
    catch (ex) {
      console.log("accounts_to_track parse error: ", ex)
    }



    chrome.runtime.sendMessage({ action: "getCurrentTabId" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error chrome.runtime.lastError:", chrome.runtime.lastError.message);
      } else {
        console.log("Received tabId response:", response);
        const tabId = response.tabId; // Получаем tabId из ответа
        console.log('tabId from message', tabId)

        if (tabId) {
          chrome.runtime.sendMessage({
            action: "processData",
            tweet_url: window.location.href,
            data: data,
            tabId: tabId
          });
        }
      }
    });

  }

  if (event.data.type === "SEND_TWEET_REPLY") {
    // Отправляем запрос в background.js
    console.log("forward SEND_TWEET_REPLY in content")
    chrome.runtime.sendMessage({action: "PRODUCE_TWEET_REPLY", data: event.data.data, replyButton: event.data.replyButton }, (response) => {
      // Здесь вы получаете ответ от background.js
      if (response.success) {
        console.log("Ответ от background.js:", response.data, response.replyButton);
        // Пересылаем ответ обратно в script.js
        window.postMessage({type: "PRODUCE_TWEET_REPLY", success: response.success, data: response.data, replyButton: response.replyButton}, "*");
      } else {
        console.error("Ошибка:", response.error);
      }
    });
  }

  // console.log("event addEventListener content", event)
  //
  // if (event.data.type === "PRODUCE_TWEET_REPLY") {
  //   // Отправляем запрос в background.js
  //   chrome.runtime.sendMessage(event.data.data, (response) => {
  //     // Обрабатываем ответ от background.js
  //     if (response.success) {
  //       console.log("Ответ от background.js:", response.data);
  //       // Вызываем функцию для обработки данных в script.js, если нужно
  //       window.postMessage({ type: "PRODUCE_TWEET_REPLY", data: response.data }, "*");
  //     } else {
  //       console.error("Ошибка:", response.error);
  //     }
  //   });
  // }

});

// Inject config changes from options pages into the settings <script>
function onConfigChange(changes) {
  let configChanges = Object.fromEntries(
    Object.entries(changes).map(([key, {newValue}]) => [key, newValue])
  )
  $settings.innerText = JSON.stringify(configChanges)
}

// Store config changes sent from the injected script
window.addEventListener('message', (event) => {
  // console.log("content  window onMessage", event.data.action)
  if (event.source !== window) return
  if (event.data.type === 'tntConfigChange' && event.data.changes) {
    chrome.storage.onChanged.removeListener(onConfigChange)
    chrome.storage.local.set(event.data.changes, () => {
      chrome.storage.onChanged.addListener(onConfigChange)
    })
  }
}, false)


///////////////////

// Функция для отправки сообщения о готовности
function notifyReady() {
  chrome.runtime.sendMessage({action: "contentScriptReady"});
}

// Проверяем, доступен ли уже DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', notifyReady);
} else {
  notifyReady();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log("content onMessage", message);
  if (message.action === "saveToLocalStorage") {
    try {
      localStorage.setItem(message.data.key, message.data.value);
      chrome.runtime.sendMessage({action: "localStorageSaved", success: true});
    } catch (error) {
      console.error("Ошибка при сохранении в localStorage:", error);
      chrome.runtime.sendMessage({action: "localStorageSaved", success: false, error: error.message});
    }
  }
});

//
// setInterval(()=> {
//   let $timeline = /** @type {HTMLElement} */ (document.querySelector('[data-testid="vss-scroll-view"] > div'))
//   console.log("$timeline", $timeline, document)
//   if ($timeline) {
//     for (let $item of $timeline.children) {
//       //   TWEET: '[data-testid="tweet"]',
//       let $tweet = $item.querySelector('[data-testid="tweet"]')
//
//       if ($tweet && !$tweet.querySelector(".reply-button")) {
//         // Создаем новую кнопку
//         let $button = document.createElement("button");
//         $button.innerText = "Ответить11"; // Текст кнопки
//         $button.classList.add("reply-button"); // Добавляем класс для идентификации кнопки
//
//         // Добавляем обработчик событий для кнопки
//         $button.addEventListener("click", async () => {
//           // Данные для отправки
//           const data = {
//             message: "Hello, Illia!", // Замените это на нужное сообщение
//             old_messages: [] // Замените это на массив старых сообщений, если нужно
//           };
//
//           window.postMessage({type: "SEND_TWEET_REPLY", data: data}, "*");
//
//           // try {
//           //   const response = await fetch("http://127.0.0.1:8009/tweet_reply/", {
//           //     method: "POST",
//           //     headers: {
//           //       "Content-Type": "application/json"
//           //     },
//           //     body: JSON.stringify(data)
//           //   });
//           //
//           //   // Обработка ответа
//           //   if (response.ok) {
//           //     const result = await response.json();
//           //     console.log("Ответ от сервера:", result);
//           //   } else {
//           //     console.error("Ошибка при отправке запроса:", response.statusText);
//           //   }
//           // } catch (error) {
//           //   console.error("Ошибка сети:", error);
//           // }
//         });
//
//         // Добавляем кнопку под элементом твита
//         $tweet.appendChild($button);
//       }
//     }
//   }
// }, 1000);