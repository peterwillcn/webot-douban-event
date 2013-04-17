process.on('uncaughtException', function (err) {
  error('Caught exception: ' + err);
  if ('trace' in err) {
    err.trace();
  }
  if ('stack' in err) {
    console.log(err.stack);
  }
});

var express = require('express');
var debug = require('debug');
var log = debug('weixin');
var error = debug('weixin:error');

var webot = require('weixin-robot');
var douban = require('./lib/douban');
var fanjian = require('./lib/fanjian');

var mapping = webot.config.mapping = function(item, i) {
  item.pic = item.image_lmobile;
  item.url = item.adapt_url && item.adapt_url.replace('adapt', 'partner') || '';
  item.description = item.owner && douban.eventDesc(item);
  return item;
};
require('js-yaml');
require('./rules')(webot);

var messages = require('./data/messages');
var conf = require('./conf');

webot.config.codeReplies = messages;

var app = express();
app.use(express.static(__dirname + '/static'));
app.enable('trust proxy');
app.engine('jade', require('jade').__express);
app.set('view engine', 'jade');
app.set('views', __dirname + '/templates');

var checkSig = webot.checkSig(conf.weixin);

app.get('/', checkSig);
app.post('/', checkSig, webot.bodyParser(), fanjian.middleware(), function(req, res, next) {
  var info = req.wx_data;

  res.type('xml');

  function end() {
    if (info.is_zht) {
      fanjian.zhs2zht(info.reply, function(ret) {
        info.reply = ret || info.reply;
        res.send(info.toXML(mapping));
      });
      return;
    }
    res.send(info.toXML(mapping));
  }

  if (!info) {
    info.reply = messages['400'];
    return end();
  }

  webot.reply(info, function(err, ret) {
    var param = info.param || {};

    if (err == 404 && param.start) {
      info.reply = messages['NO_MORE'];
    } else if (err || !ret) {
      //res.statusCode = (typeof err === 'number' ? err : 500);
      info.reply = ret || messages[String(err)] || messages['503'];
    }

    if (Array.isArray(info.reply) && info.has_more) {
      info.reply.push({
        title: '回复 more 查看更多...'
      });
    }

    end();
  });
});

var port = conf.port || 3000;
var hostname = conf.hostname || '127.0.0.1';
app.listen(port, hostname, function() {
  log('listening on ', hostname, port);
});
