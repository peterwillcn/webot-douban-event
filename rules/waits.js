var pwd = process.cwd();
var data = require(pwd + '/data');
var parser = require(pwd + '/lib/parser');
var user = require(pwd + '/lib/user');
var douban = require(pwd + '/lib/douban');
var weather = require(pwd + '/lib/weather');

var cities = data.cities;
var etypes = data.types;

module.exports = function(webot) {

var reg_lonely = /(妹子|妹纸|帅哥|美女|姑娘|^小?美?妞)/;
webot.set('lonely', {
  pattern: reg_lonely,
  handler: function(uid, info) {
    var q = info.param['q'] || info.text;
    var loc_id = info.param['loc'];
    var u = info.u;
    var webot = this;
    webot.data(uid, { 'type': 'party', 'loc': loc_id });
    if (loc_id) {
      return '多出门参加一点同城活动就能遇见' + q.match(reg_lonely)[0] + '了哦？要不我帮你在' + cities.id2name[loc_id] + '找一些聚会类的活动？';
    } else {
      webot.data(uid, 'want_city', 'lonely');
      return '想认识更多好朋友？告诉我你所在的城市，让我帮你找点聚会类的活动吧';
    }
  },
  replies: {
    Y: function(uid, info, cb) {
      var u = info.u || user(uid);
      u.getLoc(function(err, loc) {
        douban.list({
          loc: loc,
          type: 'party'
        }, cb);
      });
    },
    N: '好的，你说不要就不要'
  }
});
webot.set('who_create1', {
  pattern: /你是.+做的/,
  handler: '我其实是一个很猥琐的程序员做的，要我把他的微信号告诉你吗？',
  'replies': {
    'Y': '好的，他的微信帐号是：YjgxNTQ5ZmQzYTA0OWNjNTQ3NzliNGMyNzRmYjdhMTUK',
    'N': '可惜了啊，其实他还长得蛮帅的' 
  }
});
webot.set('who_create2', {
  pattern: function(info) {
    var reg = /(什么人|谁|哪位.*|哪个.*)(给|为|帮)?你?(设置|做|配置|制造|制作|设计|写|创造|生产?)(了|的)?/;
    return reg.test(info.text) && info.text.replace(reg, '').indexOf('你') === 0;
  },
  handler: '一个很猥琐的程序员，要我把他的微信号告诉你吗？',
  'replies': {
    'Y': '好的，他的微信帐号是：YjgxNTQ5ZmQzYTA0OWNjNTQ3NzliNGMyNzRmYjdhMTUK',
    'N': '可惜了啊，其实他还长得蛮帅的' 
  }
});
var reg_search_cmd = /^(搜索?|search|s)$/;
webot.set('search_cmd', {
  'pattern': reg_search_cmd,
  'handler': '你想搜什么？',
  'replies': function(uid, info, cb) {
    var u = info.u || user(info.from);
    var webot = this;
    var next = function(err, loc) {
      if (loc) {
        var q = info.text.replace(reg_search_cmd);
        return douban.search({ loc: loc, q: q }, cb);
      }
      webot.data(uid, 'q', info.text);
      webot.data(uid, 'want_city', 'search_cmd');
      return cb(null, '哎呀，我还不知道你住在哪个城市呢……');
    };
    info.param = info.param || parser.listParam(info.text);
    var loc = info.param['loc'];
    if (loc) return true;
    u.getLoc(next);
  }
});
webot.set('search', {
  'pattern': function(info) {
    info.param = info.param || {};
    var text = info.param['q'] || info.text;
    return info.type == 'text' && text.length < 15;
  },
  'handler': function(uid, info) {
    var q = info.param['q'] || info.text;
    var loc_id = info.param['loc'];

    var u = info.u;

    var webot = this;

    // save user data
    webot.data(uid, { 'q': q, 'loc': loc_id });
    var type = info.param['type'] || '';
    if (type) {
      type = etypes[type] || '';
      type = type && type.split('|')[0];
    }
    if (loc_id) {
      return '要我在' + cities.id2name[loc_id] + '搜索“' + q +
      '”相关的' + type + '活动吗？请回复“要”或“不要”，回复“要要要”总是尝试搜索';
    } else {
      webot.data(uid, 'want_city', 'search');
      return '告诉我你所在的城市，我就可以帮你查找“' + q + '”相关的活动';
    }
  },
  'replies': {
    'Y': function(uid, info, cb) {
      var d = this.data(uid);
      if (!d['loc']) {
        cb(null, '我需要先知道你在哪个城市哦亲');
        this.reserve(uid, 'search');
        return
      }
      if (!d['loc'] || !d['q']) return true;
      d['uid'] = uid;
      return douban.search(d, cb);
    },
    '永远不要|(不要){2,}|你好啰嗦|你好烦|取消|去死|呸': function(uid, info, cb) {
      var u = info.u || user(info.from);
      u.setProp('stop_search', 1, function() {
        return cb(null, '好的，今后我听不懂你的话时将不再询问你是否搜索。\n你总是可以发送“搜索 xxx”来直接搜索 xxx 相关的活动。');
      });
    },
    '要要要': function(uid, info, cb) {
      var u = info.u || user(info.from);
      u.setProp('stop_search', 2, function() {
        return cb(null, '要要要，切克闹！\n今后我听不懂你的话时将总是尝试为你查找相关活动。\n你可以回复“别闹了”取消此设置。\n再次发送刚才的关键字开始搜索。');
      });
    },
    'N': '好的，你说不要就不要' 
  }
});
webot.set('city_weather', {
  'handler': '要查询天气，我需要先知道你在哪个城市',
  'replies': function(uid, info, cb) {
    var loc = info.text;
    var param = parser.listParam(info.text);
    var loc_id = param['loc'];
    if (loc_id && loc_id in cities.id2name) {
      user(info.from).setLoc(loc_id);
      loc = cities.id2name[loc_id]
    }
    weather(loc, function(err, res) {
      if (err || ! res) return cb(err);
      return cb(null, res);
    });
  }
});

var r_wikisource = require('./routes/wikisource');
webot.set('wikisource', {
  'replies': function(uid, info, cb) {
    var kw = info.text;
    var m = kw.match(r_wikisource.reg_recite);
    if (m) kw = m[4];
    info.kw = kw;
    r_wikisource.handler(info, cb);
  }
});

var chengyu = require(pwd + '/data').chengyu;
webot.set('jielong', {
  'handler': function(uid, q) {
    this.data(uid, 'jielong', q);
    return q;
  },
  'replies': {
    '((什么|什麽|甚么|嘛|啥)意思|解释|释义)': function(uid, info, cb) {
      var q = this.data(uid, 'jielong');
      var ret = q && chengyu.explain[q];
      if (ret) return cb(null, '【' + q + '】' + ret);
      return cb(null, '我也不知道是什么意思呢...');
    }
  }
});

});
