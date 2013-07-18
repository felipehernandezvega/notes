// Generated by CoffeeScript 1.4.0
(function() {
  var $, Dropbox, NodeWebkitDriver, S, Splitter, autogrow, buffer, db, gui, handlebars, http, isOpen, jonoeditor, marked, modal, net, path, rangyinputs, util;

  global.document = document;

  gui = global.gui = require('nw.gui');

  buffer = require('buffer');

  path = require('path');

  net = require('net');

  util = require('util');

  global.jQuery = $ = require('jQuery');

  Dropbox = require('dropbox');

  handlebars = require('handlebars');

  marked = require('marked');

  http = require('http');

  S = require('string');

  db = require('./javascript/db');

  Splitter = require('./javascript/lib/splitter');

  modal = require('./javascript/lib/modal');

  autogrow = require('./javascript/lib/autogrow');

  rangyinputs = require('./javascript/lib/rangyinputs');

  isOpen = function(port, host, callback) {
    var conn, executed, onClose, onOpen, timeoutId;
    isOpen = false;
    executed = false;
    onClose = function() {
      var exectued;
      if (executed) {
        return;
      }
      exectued = true;
      clearTimeout(timeoutId);
      delete conn;
      return callback(isOpen, port, host);
    };
    onOpen = function() {
      isOpen = true;
      return conn.end();
    };
    timeoutId = setTimeout(function() {
      return conn.destroy();
    }, 400);
    conn = net.createConnection(port, host, onOpen);
    conn.on("close", function() {
      if (!executed) {
        return onClose();
      }
    });
    conn.on("error", function() {
      return conn.end();
    });
    return conn.on("connect", onOpen);
  };

  NodeWebkitDriver = (function() {

    function NodeWebkitDriver(options) {
      this.port = (options != null ? options.port : void 0) || 8912;
      this.callbacks = {};
      this.nodeUrl = require('url');
      this.createApp();
    }

    NodeWebkitDriver.prototype.url = function(token) {
      return ("http://localhost:" + this.port + "/oauth_callback?dboauth_token=") + encodeURIComponent(token);
    };

    NodeWebkitDriver.prototype.doAuthorize = function(authUrl, token, tokenSecret, callback) {
      this.callbacks[token] = callback;
      return gui.Shell.openExternal(authUrl);
    };

    NodeWebkitDriver.prototype.createApp = function() {
      var _this = this;
      this.app = http.createServer(function(request, response) {
        return _this.doRequest(request, response);
      });
      return this.app.listen(this.port);
    };

    NodeWebkitDriver.prototype.closeServer = function() {
      return this.app.close();
    };

    NodeWebkitDriver.prototype.doRequest = function(request, response) {
      var data, rejected, token, url,
        _this = this;
      url = this.nodeUrl.parse(request.url, true);
      if (url.pathname === '/oauth_callback') {
        if (url.query.not_approved === 'true') {
          rejected = true;
          token = url.query.dboauth_token;
        } else {
          rejected = false;
          token = url.query.oauth_token;
        }
        if (this.callbacks[token]) {
          this.callbacks[token](rejected);
          delete this.callbacks[token];
        }
      }
      data = '';
      request.on('data', function(dataFragment) {
        return data += dataFragment;
      });
      return request.on('end', function() {
        return _this.closeBrowser(response);
      });
    };

    NodeWebkitDriver.prototype.closeBrowser = function(response) {
      var closeHtml;
      closeHtml = "<!doctype html>\n<p>Please close this window and go back to Noted.</p>";
      response.writeHead(200, {
        'Content-Length': closeHtml.length,
        'Content-Type': 'text/html'
      });
      response.write(closeHtml);
      return response.end();
    };

    return NodeWebkitDriver;

  })();

  jonoeditor = (function() {

    function jonoeditor(el, timer) {
      var _this = this;
      this.el = el;
      this.timer = timer;
      this.el.prop("disabled", false);
      this.el.html("<textarea></textarea>");
      this.el.find("textarea").autogrow().on("change keyup", function() {
        clearTimeout(_this.timer);
        return _this.timer = setTimeout(function() {
          return window.noted.save();
        }, 10000);
      });
    }

    jonoeditor.prototype.getReadOnly = function() {
      return this.el.prop("disabled");
    };

    jonoeditor.prototype.setReadOnly = function(bool) {
      return this.el.prop("disabled", bool);
    };

    jonoeditor.prototype.getValue = function() {
      return this.el.find("textarea").val();
    };

    jonoeditor.prototype.setValue = function(value) {
      return this.el.find("textarea").val(value);
    };

    jonoeditor.prototype.hide = function() {
      return this.el.hide();
    };

    jonoeditor.prototype.show = function() {
      return this.el.show();
    };

    return jonoeditor;

  })();

  window.noted = {
    currentList: "all",
    currentNote: "",
    auth: function() {
      var callback, elem;
      elem = $("#sync");
      elem.addClass("spin");
      if (window.noted.db.client) {
        callback = function(err) {
          if (err) {
            return window.noted.util.err();
          }
          console.log("sync done");
          elem.removeClass("spin");
          return setTimeout(function() {
            window.noted.load.notebooks();
            window.noted.load.notes(window.noted.currentList);
            if (window.noted.currentNote !== "" && window.noted.editor.getReadOnly() === true) {
              return window.noted.load.note(window.noted.currentNote);
            }
          }, 2500);
        };
        if (window.noted.db.cursor === "") {
          console.log("going for first sync");
          return window.noted.db.firstSync(callback);
        } else {
          console.log("going for queue sync");
          return window.noted.db.syncQueue(callback);
        }
      } else if (window.localStorage.oauth) {
        window.client.oauth = new Dropbox.Oauth(JSON.parse(localStorage.oauth));
        return window.client.getUserInfo(function(err) {
          if (err) {
            localStorage.removeItem("oauth");
            return window.noted.util.err();
          }
          window.noted.db.client = window.client;
          return window.noted.auth();
        });
      } else {
        elem.removeClass("spin");
        return window.client.authenticate(function(err, client) {
          if (err) {
            client.reset();
            return window.noted.util.err();
          }
          localStorage.oauth = JSON.stringify(client.oauth);
          return window.noted.auth();
        });
      }
    },
    init: function() {
      var _base, _base1, _ref, _ref1,
        _this = this;
      window.noted.homedir = process.env.HOME;
      if (process.platform === 'darwin') {
        window.noted.storagedir = path.join(window.noted.homedir, "/Library/Application Support/Noted/");
      } else if (process.platform === 'win32') {
        window.noted.storagedir = path.join(process.env.LOCALAPPDATA, "/Noted/");
      } else if (process.platform === 'linux') {
        window.noted.storagedir = path.join(window.noted.homedir, '/.config/Noted/');
      }
      if ((_ref = (_base = window.localStorage).queue) == null) {
        _base.queue = "{}";
      }
      if ((_ref1 = (_base1 = window.localStorage).cursor) == null) {
        _base1.cursor = "";
      }
      window.noted.db = new db(path.join(window.noted.storagedir, "Notebooks"), null, "queue", window.localStorage.cursor);
      window.client = new Dropbox.Client({
        key: "GCLhKiJJwJA=|5dgkjE/gvYMv09OgvUpzN1UoNir+CfgY36WwMeNnmQ==",
        sandbox: true
      });
      isOpen((Math.round(Math.random() * 48120) + 1024).toString(), "127.0.0.1", function(isportopen, port, host) {
        if (isportopen) {
          port = Math.round(Math.random() * 48120) + 1024;
        }
        return window.client.authDriver(new NodeWebkitDriver(port));
      });
      return window.noted.initUI();
    },
    initUI: function() {
      $("#sync").removeClass("spin");
      Splitter.init({
        parent: $('#parent')[0],
        panels: {
          left: {
            el: $("#notebooks")[0],
            min: 150,
            width: 200,
            max: 450
          },
          center: {
            el: $("#notes")[0],
            min: 250,
            width: 300,
            max: 850
          },
          right: {
            el: $("#content")[0],
            min: 450,
            width: 550,
            max: Infinity
          }
        }
      });
      window.noted.window = gui.Window.get();
      window.noted.window.show();
      window.noted.window.showDevTools();
      window.noted.load.notebooks();
      window.noted.load.notes("all");
      window.noted.editor = new jonoeditor($("#contentwrite"));
      $("#contentread").on("click", "a", function(e) {
        e.preventDefault();
        return gui.Shell.openExternal($(this).attr("href"));
      });
      $('.modal.settings .false').click(function() {
        return $('.modal.settings').modal("hide");
      });
      $('#panel').mouseenter(function() {
        return $('#panel').addClass('drag');
      }).mouseleave(function() {
        return $('#panel').removeClass('drag');
      });
      $('#panel #decor img, #panel #noteControls img, #panel #search').mouseenter(function() {
        return $('#panel').removeClass('drag');
      }).mouseleave(function() {
        return $('#panel').addClass('drag');
      });
      $('#noteControls img').click(function() {
        var mailto;
        if ($(this).attr("id") === "new" && window.noted.currentList !== "all") {
          window.noted.db.createNote("Untitled Note", window.noted.currentList, "# This is your new blank note\n\nAdd some content!");
          window.noted.load.notes(window.noted.currentList);
          return $("#notes ul li:first").addClass("edit").trigger("click");
        } else if (!$("#noteControls").hasClass("disabled")) {
          if ($(this).attr("id") === "share") {
            $(".popover-mask").show();
            $(".share-popover").css({
              left: ($(event.target).offset().left) - 3,
              top: "28px"
            }).show();
            mailto = "mailto:?subject=" + encodeURI(window.noted.currentNote) + "&body=" + encodeURI(window.noted.editor.getValue());
            return $("#emailNote").parent().attr("href", mailto);
          } else if ($(this).attr("id") === "del") {
            return $('.modal.delete').modal();
          }
        }
      });
      $(".modal.delete .true").click(function() {
        $('.modal.delete').modal("hide");
        if (window.noted.currentNote !== "") {
          $("#notes li[data-id=" + window.noted.currentNote + "]").remove();
          window.noted.db.deleteNote(window.noted.currentNote);
          return window.noted.deselect();
        }
      });
      $(".modal.delete").click(function() {
        return $(".modal.delete").modal("hide");
      });
      $(".modal.deleteNotebook .true").click(function() {
        $('.modal.deleteNotebook').modal("hide");
        window.noted.db.deleteNotebook(window.noted.currentList);
        $("#notebooks li[data-id=" + window.noted.currentList + "]").remove();
        return $("#notebooks li").first().trigger("click");
      });
      $(".modal.renameNotebook .true").click(function() {
        var name;
        $('.modal.renameNotebook').modal("hide");
        name = $('.modal.renameNotebook input').val();
        if (name !== "") {
          window.noted.db.updateNotebook(window.noted.currentList, {
            name: name
          });
          return $("#notebooks li[data-id=" + window.noted.currentList + "]").text(name);
        }
      });
      $(".modal.deleteNotebook .false").click(function() {
        return $(".modal.deleteNotebook").modal("hide");
      });
      $(".modal.error .false").click(function() {
        return $(".modal.error").modal("hide");
      });
      $(".modal.renameNotebook .false").click(function() {
        return $(".modal.renameNotebook").modal("hide");
      });
      $('body').on("click", "#close", function() {
        return window.noted.window.close();
      });
      $('body').on("click", "#minimize", function() {
        return window.noted.window.minimize();
      });
      $('body').on("click", "#maximize", function() {
        return window.noted.window.maximize();
      });
      $('body').on("keydown", "#notebooks input", function(e) {
        if (e.keyCode === 13) {
          e.preventDefault();
          window.noted.db.createNotebook($(this).val());
          window.noted.load.notebooks();
          return $(this).val("").blur();
        }
      });
      $('body').on("click contextmenu", "#notebooks li", function() {
        window.noted.load.notes($(this).attr("data-id"));
        return window.noted.deselect();
      });
      $('body').on("contextmenu", "#notebooks li", function(e) {
        $(".popover-mask").show();
        return $(".delete-popover").css({
          left: $(event.target).outerWidth(),
          top: $(event.target).offset().top
        }).show();
      });
      $('body').on("click contextmenu", ".popover-mask", function() {
        return $(this).hide().children().hide();
      });
      $("#sync").click(function() {
        return window.noted.auth();
      });
      $("body").on("keydown", ".headerwrap .left h1", function(e) {
        if (e.keyCode === 13 && $(this).text() !== "") {
          return e.preventDefault();
        }
      });
      $("body").on("keyup change", ".headerwrap .left h1", function() {
        var name;
        name = $(this).text();
        if (name !== "") {
          return $("#notes [data-id='" + window.noted.currentNote + "']").find("h2").text(name);
        }
      });
      $("body").on("keydown", "#search", function(e) {
        if (e.keyCode === 13 && $(this).text() !== "") {
          return e.preventDefault();
        }
      });
      $("body").on("keyup change", "#search", function() {
        var htmlstr, query, results, template,
          _this = this;
        query = $('#panel #search input').val();
        if (query !== "") {
          template = handlebars.compile($("#note-template").html());
          htmlstr = "";
          window.noted.deselect();
          window.noted.load.notes("all");
          $('#notes ul').html();
          results = window.noted.db.search(query);
          results.forEach(function(note) {
            return htmlstr = template({
              id: note.id,
              name: note.name,
              date: window.noted.util.date(note.date),
              excerpt: note.content.substring(0, 100)
            }) + htmlstr;
          });
          return $('#notes ul').html(htmlstr);
        }
      });
      $('body').on("click", "#notes li", function() {
        return window.noted.load.note($(this).attr("data-id"));
      });
      $('body').on("click", "#deleteNotebook", function() {
        return $('.modal.deleteNotebook').modal();
      });
      $('body').on("click", "#renameNotebook", function() {
        var name;
        name = $(".popover-mask").attr("data-parent");
        $('.modal.renameNotebook').modal();
        return $('.modal.renameNotebook input').val(name).focus();
      });
      $("#content .edit").click(function() {
        if (window.noted.editor.getReadOnly() === false) {
          window.noted.save();
          clearTimeout(noted.editor.timer);
        }
        return window.noted.editMode();
      });
      $(".tabs ul").click(function(e) {
        $(this).find(".current").removeClass("current");
        $(".preferences-container .container").find(".current").removeClass("current");
        return $(".preferences-container .container").find("div." + $(e.target).addClass("current").attr("data-id")).addClass("current");
      });
      return $("body").on("click", ".editorbuttons button", function() {
        return window.noted.editorAction($(this).attr('data-action'));
      });
    },
    editorAction: function(action) {
      var $area, newsel, newsel1, newsel2, newsel3, sel, url;
      $area = $('#contentwrite textarea');
      sel = $area.getSelection();
      if (action === 'bold') {
        $area.setSelection(sel.start - 2, sel.end + 2);
        newsel = $area.getSelection();
        if (S(newsel.text).endsWith("**") && S(newsel.text).startsWith("**")) {
          $area.deleteText(newsel.start, newsel.start + 2);
          $area.deleteText(newsel.end - 4, newsel.end - 2);
          return $area.setSelection(sel.start - 2, sel.end - 2);
        } else {
          $area.setSelection(sel.start, sel.end);
          return $area.surroundSelectedText("**", "**");
        }
      } else if (action === 'italics') {
        $area.setSelection(sel.start - 1, sel.end + 1);
        newsel = $area.getSelection();
        if (S(newsel.text).endsWith("*") && S(newsel.text).startsWith("*")) {
          $area.deleteText(newsel.start, newsel.start + 1);
          $area.deleteText(newsel.end - 2, newsel.end - 1);
          return $area.setSelection(sel.start - 1, sel.end - 1);
        } else {
          $area.setSelection(sel.start, sel.end);
          return $area.surroundSelectedText("*", "*");
        }
      } else if (action === 'hyperlink') {
        url = prompt("Enter the URL of the hyperlink", "");
        return $area.surroundSelectedText("[", "](" + url + ")");
      } else if (action === 'heading') {
        $area.setSelection(sel.start - 2, sel.end);
        newsel1 = $area.getSelection();
        $area.setSelection(sel.start - 3, sel.end);
        newsel2 = $area.getSelection();
        $area.setSelection(sel.start - 4, sel.end);
        newsel3 = $area.getSelection();
        if (S(newsel3.text).startsWith("### ")) {
          $area.deleteText(newsel3.start, newsel3.start + 4);
          return $area.setSelection(sel.start - 4, sel.end - 4);
        } else if (S(newsel2.text).startsWith("## ")) {
          $area.deleteText(newsel2.start, newsel2.start + 3);
          $area.setSelection(sel.start - 3, sel.end - 3);
          return $area.surroundSelectedText("### ", "");
        } else if (S(newsel1.text).startsWith("# ")) {
          $area.deleteText(newsel1.start, newsel1.start + 2);
          $area.setSelection(sel.start - 2, sel.end - 2);
          return $area.surroundSelectedText("## ", "");
        } else {
          $area.setSelection(sel.start, sel.end);
          return $area.surroundSelectedText("# ", "");
        }
      } else if (action === 'img') {
        url = prompt("Enter the URL of the image", "");
        return $area.surroundSelectedText("![", "](" + url + ")");
      }
    },
    deselect: function() {
      $("#content").addClass("deselected");
      return window.noted.currentNote = "";
    },
    editMode: function(mode) {
      var el;
      el = $("#content .edit");
      $("#content").removeClass("deselected");
      if (mode === "preview" || window.noted.editor.getReadOnly() === false && mode !== "editor") {
        el.removeClass("save").text("edit");
        $('#content .left h1').attr('contenteditable', 'false');
        $("#content .right time").show();
        $("#contentread").html(marked(window.noted.editor.getValue())).show();
        $("#content .editorbuttons").removeClass("show");
        window.noted.editor.hide();
        return window.noted.editor.setReadOnly(true);
      } else {
        el.addClass("save").text("save");
        $('.headerwrap .left h1').attr('contenteditable', 'true');
        $("#content .right time").hide();
        $("#contentread").hide();
        $("#content .editorbuttons").addClass("show");
        window.noted.editor.show();
        window.noted.editor.setReadOnly(false);
        return $(window).trigger("resize");
      }
    },
    save: function() {
      var info, lastIndex, text;
      if (window.noted.currentNote !== "") {
        text = $('.headerwrap .left h1').text();
        if (text === "") {
          text = "Untitled Note";
        }
        info = window.noted.editor.getValue();
        if (info.length > 90) {
          info = info.substring(0, 100);
          lastIndex = info.lastIndexOf(" ");
          info = info.substring(0, lastIndex) + "&hellip;";
        }
        info = $(marked(info)).text();
        $("#notes [data-id=" + window.noted.currentNote + "]").find("span").text(info).parent().find("time").text("Today -");
        window.noted.db.updateNote(window.noted.currentNote, {
          name: text,
          content: window.noted.editor.getValue(),
          notebook: window.noted.db.readNote(window.noted.currentNote).notebook
        });
        if (window.localStorage.oauth) {
          return window.noted.auth();
        }
      }
    },
    load: {
      notebooks: function() {
        var arr, htmlstr, template;
        template = handlebars.compile($("#notebook-template").html());
        htmlstr = template({
          name: "All Notes",
          id: "all"
        });
        arr = window.noted.db.readNotebooks(true);
        arr.forEach(function(notebook) {
          return htmlstr += template({
            name: notebook.name,
            id: notebook.id
          });
        });
        return $("#notebooks ul").html(htmlstr);
      },
      notes: function(list) {
        var data, htmlstr, note, order, template, _i, _len;
        window.noted.currentList = list;
        if (list === "all") {
          $("#noteControls").addClass("all");
        } else {
          $("#noteControls").removeClass("all");
        }
        $("#noteControls").addClass("disabled");
        $("#notebooks li.selected").removeClass("selected");
        $("#notebooks li[data-id=" + list + "]").addClass("selected");
        template = handlebars.compile($("#note-template").html());
        htmlstr = "";
        data = window.noted.db.readNotebook(list, true);
        order = [];
        data.contents.forEach(function(file) {
          var lastIndex;
          if (file.info.length > 90) {
            lastIndex = file.info.lastIndexOf(" ");
            file.info = file.info.substring(0, lastIndex) + "&hellip;";
          }
          file.info = $(marked(file.info)).text();
          return order.push({
            id: file.id,
            date: file.date * 1000,
            name: file.name,
            info: file.info
          });
        });
        order.sort(function(a, b) {
          return new Date(a.time) - new Date(b.time);
        });
        for (_i = 0, _len = order.length; _i < _len; _i++) {
          note = order[_i];
          htmlstr = template({
            id: note.id,
            name: note.name,
            list: list,
            date: window.noted.util.date(note.date),
            excerpt: note.info
          }) + htmlstr;
        }
        return $("#notes ul").html(htmlstr);
      },
      note: function(id) {
        var data, time;
        window.noted.currentNote = id;
        $("#noteControls").removeClass("disabled");
        $("#notes .selected").removeClass("selected");
        $("#notes li[data-id=" + id + "]").addClass("selected");
        data = window.noted.db.readNote(id);
        $('.headerwrap .left h1').text(data.name);
        $("#contentread").html(marked(data.content)).show();
        window.noted.editor.setValue(data.content);
        window.noted.editor.setReadOnly(true);
        time = new Date(data.date * 1000);
        $('.headerwrap .right time').text(window.noted.util.date(time) + " " + window.noted.util.pad(time.getHours()) + ":" + window.noted.util.pad(time.getMinutes()));
        return window.noted.editMode("preview");
      }
    },
    util: {
      date: function(date) {
        var difference, month, now, oneDay, words;
        date = new Date(date);
        month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        now = new Date();
        difference = 0;
        oneDay = 86400000;
        words = '';
        difference = Math.ceil((date.getTime() - now.getTime()) / oneDay);
        if (difference === 0) {
          words = "Today";
          if (now.getDate() !== date.getDate()) {
            words = "Yesterday";
          }
        } else if (difference === -1) {
          words = "Yesterday";
        } else if (difference > 0) {
          words = "Today";
        } else if (difference > -15) {
          words = Math.abs(difference) + " days ago";
        } else if (difference > -365) {
          words = month[date.getMonth()] + " " + date.getDate();
        } else {
          words = window.noted.util.pad(date.getFullYear()) + "-" + (window.noted.util.pad(date.getMonth() + 1)) + "-" + window.noted.util.pad(date.getDate());
        }
        return words;
      },
      err: function() {
        $(".modal.error").modal("show");
        return $("#sync").removeClass("spin");
      },
      pad: function(n) {
        if (n < 10) {
          return "0" + n;
        } else {
          return n;
        }
      }
    }
  };

  window.noted.init();

}).call(this);
