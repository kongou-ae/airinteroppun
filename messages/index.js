"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var path = require('path');
var request = require('request');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));

function createThumbnailCard(session) {
    return new builder.HeroCard(session)
        .images([
            builder.CardImage.create(session, session.message.text)
        ])
}

const convertTag = function(tag){
    const tagToMessage = {
        'a10':'A10ネットワーク',
        'alaxala':'アラクサラ',
        'alliedtelesis':'アライドテレシス',
        'arista':'アリスタ',
        'checkpoint':'チェックポイント',
        'cisco-rt':'シスコのルータ',
        'cisco-sw':'シスコのスイッチ',
        'dell':'デル',
        'dlink':'D-Link',
        'f5':'F5ネットワークス',
        'fortigate-black':'フォーティゲート',
        'fortigate-white':'フォーティゲート',
        'juniper-fw':'ジュニパーのファイアウォール',
        'juniper-sw':'ジュニパーのスイッチ',
        'nec':'NEC',
        'palo':'パロアルト',
        'yamaha-fw':'ヤマハのファイアウォール',
        'yamaha-router':'ヤマハのルータ',
        'yamaha-sw':'ヤマハのスイッチ'
    }
    return tagToMessage[tag]
}

bot.dialog('/', [
    function (session) {
        session.send("こんにちは！");
        session.beginDialog('/qa');
    }
])

bot.dialog('/qa', [
    function (session,args,next) {
        // URLが入力されている→URLの入力を促さない
        if (session.message.text.match(/^(http|https):\/\//)){
            next()
        } else{
            builder.Prompts.text(session, 'ネットワーク機器の画像のURLを入力してください。どのメーカの機器かあてますよ！');
        }
    },
    function (session,url,next) {
        if(session.message.text.match(/^(http|https):\/\//)){
            var headers = {
                'Content-Type':'application/json',
                'Prediction-Key':'c77f087215014b7fb3ff718a26089cfe'
            }
            var options = {
                url: 'https://southcentralus.api.cognitive.microsoft.com/customvision/v1.0/Prediction/a2e5a117-d22e-42e8-ac3f-f7fd9fc6b63a/url?iterationId=46a48147-7fc8-4706-b0d9-9aefede16a3b',
                method: 'POST',
                headers: headers,
                json: true,
                form: {"Url":session.message.text}
            }

            request(options, function (error, response, body) {
                // APIコールした結果画像じゃなければ、入力を初期化して/qaに戻る
                if (response.statusCode === 400){
                    session.send('画像じゃないかも？');                     
                } else {
                    var card = createThumbnailCard(session);

                    // attach the card to the reply message
                    var msg = new builder.Message(session).addAttachment(card);
                    session.send(msg);

                    if(body.Predictions[0] && body.Predictions[0].Probability > 0.9){
                        session.endConversation('この画像は ' + convertTag(body.Predictions[0].Tag) + 'ですね！!');
                    } else {
                        session.endConversation('ごめんなさい。わかりません・・・');
                    }
                }
                session.message.text = ""
                session.replaceDialog("/qa");   
            })
        } else {
            session.send('URLじゃないかも？');
            session.message.text = ""
            session.replaceDialog("/qa");
        }
    }
]);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}

