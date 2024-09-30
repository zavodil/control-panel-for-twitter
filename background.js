let url_queue = []

async function getPendingTweets() {
    try {
        const response = await fetch('http://127.0.0.1:8009/get_pending_tweets/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Получаем JSON данные из ответа
        const tweets = await response.json();

        if (!tweets.length)
            return;

        console.log(`Queue: ${tweets.length}`);

        loadTwit(tweets[0].tweet_url)

        // Обрабатываем полученные твиты
        // tweets.forEach(tweet => {
        //     console.log(`Account: ${tweet.account_id}`);
        //     console.log(`Tweet URL: ${tweet.tweet_url}`);
        //     console.log(`Added at: ${tweet.added_at}`);
        //     console.log(`Updated at: ${tweet.updated_at}`);
        //     console.log(`Tweet text: ${tweet.tweet_text || 'Text not available'}`);
        //     console.log(`Tweet author: ${tweet.tweet_author || 'Author not available'}`);
        //     console.log(`Tweet time: ${tweet.tweet_time || 'Time not available'}`);
        //     console.log('---------------------------------------');
        // });

    } catch (error) {
        console.error('Error fetching pending tweets:', error);
    }
}

function removeUrl(url) {
    const indexToRemove = url_queue.indexOf(url);
    if (indexToRemove !== -1) {
        url_queue.splice(indexToRemove, 1);
        console.log(`URL удален из очереди: ${url}`);
    } else {
        console.log(`URL не найден в очереди: ${url}`);
    }
}

function loadTwit(url) {
    //console.log("loadTwit", url_queue, url)
    if (!url_queue.includes(url)) {
        url_queue.push(url)

        // let url = "https://x.com/0xMert_/status/1839976556652802078"

        console.log("loadTwit", url, chrome);


        // chrome.permissions.getAll((permissions) => {
        //     console.log(permissions);
        // });

        // window.open(url, '_blank');
        chrome.tabs.create({url: url});
    }
}

function closeCurrentTab(tabId) {
    chrome.tabs.remove(tabId, () => {
        console.log('Closed tab:', tabId);
    });
}

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.action === "closeTab") {
//         // Получаем ID вкладки, откуда пришло сообщение
//         const tabId = sender.tab.id;
//         closeCurrentTab(tabId);
//     }
// });

async function updateTweet(tweet_url, tweet_text, tweet_time, tweet_data) {
    try {
        let body = {
            tweet_url: tweet_url,
            tweet_text: tweet_text,
            tweet_author: tweet_data.user,
            tweet_time: tweet_time,
            tweet_data: JSON.stringify(parseTweetData(tweet_data))
        };

        console.log("!!!!!!!", body)
        // Отправляем POST запрос на сервер с данными твита
        const response = await fetch('http://127.0.0.1:8009/update_tweet/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Получаем ответ от сервера (например, true или false)
        const result = await response.json();

        // Логируем результат (успешно или нет)
        console.log('Tweet update successful:', result);
        return result;
    } catch (error) {
        console.error('Error updating tweet:', error);
        return false;
    }
}

function parseTweetData(tweet_data){
    return  {
        bookmark_count: tweet_data.bookmark_count,
        favorite_count: tweet_data.favorite_count, // likes
        lang: tweet_data.lang,
        reply_count: tweet_data.reply_count,
        quote_count: tweet_data.quote_count,
        retweet_count: tweet_data.retweet_count, // total retweets = retweet_count + quote_count
        id_str: tweet_data.id_str,
        views: tweet_data.views.count,
        source_name: tweet_data.source_name,
        // user: tweet_data.user,
        user_mentions: JSON.stringify(tweet_data.entities?.user_mentions ?? []),
        hashtags : JSON.stringify(tweet_data.entities?.hashtags ?? []),
        quoted_status: tweet_data?.quoted_status,
        quoted_tweet: tweet_data?.quoted_status_permalink?.expanded
    };
}

async function addFullTweet(tweet_url, tweet_text, tweet_time, tweet_data) {
    try {
        const body = {
            account_id: "ext1.near",
            tweet_url: tweet_url,
            tweet_text: tweet_text,
            tweet_author: tweet_data.user,
            tweet_time: tweet_time,
            tweet_data: JSON.stringify(parseTweetData(tweet_data))
        };

        console.log("addFullTweet", body)

        // Отправляем POST запрос на сервер с данными твита
        const response = await fetch('http://127.0.0.1:8009/add_full_tweet/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Получаем ответ от сервера (например, true или false)
        const result = await response.json();

        // Логируем результат (успешно или нет)
        console.log('Tweet update successful:', result);
        return result;
    } catch (error) {
        console.error('Error updating tweet:', error);
        return false;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("addListener", request)
    if (request.action === "getCurrentTabId") {
        console.log("Fetching active tabs...");
        // Получаем ID текущей активной вкладки
        // chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        //     const tabId = tabs[0] ? tabs[0].id : null; // Получаем ID первой активной вкладки
        //     console.log("bg getCurrentTabId", tabId)
        //     sendResponse({tabId: tabId});
        // });
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs.length > 0) {
                const tabId = tabs[0].id; // Получаем ID первой активной вкладки
                console.log("bg getCurrentTabId", tabId);
                sendResponse({tabId: tabId});
            } else {
                console.log("No active tabs found.");
                sendResponse({tabId: null}); // Если вкладок нет, возвращаем null
            }
        });
        return true; // Указываем, что ответ будет асинхронным
    }



    if (request.action === "processData") {
        const data = request.data;
        const tabId = request.tabId;
        const tweet_url = request.tweet_url;

        console.log("bg accounts_to_track", accounts_to_track, data.user.toString(), accounts_to_track.includes(data.user.toString()))

        if (url_queue.includes(tweet_url)) {
            removeUrl(tweet_url)

            console.log('Data received from content.js:', data, tabId, tweet_url);

            if (tabId) {
                closeCurrentTab(tabId);
            }

            return updateTweet(
                tweet_url,
                data.full_text,
                data.created_at,
                data
            );
        }
        else if (accounts_to_track.includes(data.user.toString())) {
            return addFullTweet(
                tweet_url,
                data.full_text,
                data.created_at,
                data
            );
        }





        // Здесь можно добавить логику обработки данных
    }




    ///////////////

    if (request.action === "contentScriptReady") {
        contentScriptReady = true;
        console.log("Content script готов к работе");
        // Отправляем накопленные сообщения
        while (pendingMessages.length > 0) {
            saveToLocalStorage(pendingMessages.shift());
        }
    } else if (request.action === "localStorageSaved") {
        if (request.success) {
            console.log("Данные успешно сохранены в localStorage");
        } else {
            console.error("Ошибка при сохранении в localStorage:", message.error);
        }
    }
    if (request.action === "localStorageSaved") {
        console.log("Данные успешно сохранены в localStorage");
    }
});

//loadTwit()
// setInterval(async () => {
//     console.log('Checking API for new URL...');
//     await getPendingTweets()
// }, 5000);
getPendingTweets()

let accounts_to_track=[
    "81185431" // illia
]

let contentScriptReady = false;
let pendingMessages = [];

saveToLocalStorage({key: "accounts_to_track", value: JSON.stringify(accounts_to_track)});
function saveToLocalStorage(data) {
    if (!contentScriptReady) {
        console.log("Content script еще не готов. Сообщение добавлено в очередь.");
        pendingMessages.push(data);
        return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "saveToLocalStorage", data: data}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error("Ошибка при отправке сообщения:", chrome.runtime.lastError);
                    // Возвращаем сообщение в очередь для повторной попытки
                    pendingMessages.push(data);
                } else {
                    console.log("Сообщение успешно отправлено в content script");
                }
            });
        } else {
            // console.error("Активная вкладка не найдена");
            // Возвращаем сообщение в очередь для повторной попытки
            pendingMessages.push(data);
        }
    });
}

setInterval(() => {
    if (pendingMessages.length > 0 && contentScriptReady) {
        // console.log("Попытка отправить отложенные сообщения");
        saveToLocalStorage(pendingMessages.shift());
    }
}, 5000);