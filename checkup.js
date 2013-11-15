"use strict";

//  Checkup.js
//  A Node.JS application wrapping PhantomJS and Twilio
//  to identify slow load time for web applications
//  and report via txt message when a maximum timeout has occurred

var LOGGLY_SUBDOMAIN = "ephekt";

var phantom = require('phantom'),
    twilio  = require('twilio-js'),
    util    = require('util'),
    http    = require('http'),
    aws     = require('aws-sdk'),
    fs      = require('fs'),
    req     = require('request'),
    loggly  = require('loggly'),
    cheerio = require('cheerio'),
    t,
    address,
    opts;

aws.config.loadFromPath('./aws.json');

twilio.AccountSid = "FILL ME IN";
twilio.AuthToken = "FILL ME IN";
// phone numbers to txt message
var recipients = ["+15555555555"];

var loggly_client = loggly.createClient({ subdomain: LOGGLY_SUBDOMAIN, json: true });

//  send_log(log)
//  input: log:json
//  POST a json object containing logging information to Miyagi (Logigng API)
var send_log = function(log) {
    // Set up the request
    console.log("Sending log: ");
    console.log(log);

    loggly_client.log("FILL ME IN", log, function (err, result) {
        if(err) {
            // TODO: Send E-mail or other form of notification of failure
            console.log(err);
            console.log(result);
        } else {
            console.log("Log pushed to Loggly");
        }
    });
}

//  send_sms(txt)
//  input: text_message:string
//  Dispatch SMS txt message to recipients using the Twilio API
var send_sms = function(txt) {
    for(var i = 0, len = recipients.length; i < len; i++) {
        console.log("Sending SMS to "+recipients[i]);
        twilio.SMS.create({to: recipients[i], from: "FILL ME IN", body: txt}, function(err,res) {
            if(err) { console.log(util.inspect(err, false, null)); }
        });
    }
}

function kill_phantom(ph) {
    console.log("Killing PhantonJS");
    ph.exit();
}

var s3 = new aws.S3();

var store_screenshot = function(entity_name,phantom_page,phantom_proc) {
    console.log("Storing screenshot for "+entity_name);

    var date = new Date();
    var date_formatted = date.getFullYear()+'_'+date.getMonth()+'_'+date.getDate();
    var prefix = entity_name+'_'+date_formatted;
    var aws_s3_bucket_name = "product-screenshots";

    // first do a list
    s3.client.listObjects({
        Bucket: aws_s3_bucket_name,
        Prefix: prefix
    },function(err,data){
        if(err) {
            console.log("Error connceting to AWS");
        } else {
            if(data.Contents.length > 0) {
                console.log("Existing SS; skipping storing of a new SS");
                //console.log(data);
                kill_phantom(phantom_proc);
            } else {
                console.log("Snapping Screenshot");
                phantom_page.render('/tmp/'+prefix+'.png',function() {
                    fs.readFile('/tmp/'+prefix+'.png', function (err, data) {
                        if (err) { 
                            console.log(err);

                            send_log({log:"PhantomJS",urgent:true,message:"Unable to write screenshot to disk.."});

                            kill_phantom(phantom_proc);
                        } else {
                            s3.client.putObject({
                                Bucket: aws_s3_bucket_name,
                                Key: prefix+'.png',
                                Body: data
                            }, function (res) {
                                    console.log('Successfully uploaded file.');
                                    kill_phantom(phantom_proc);
                                }
                            );
                        }
                    })
                });
            }
        }
    });
}

//  Begin the work of PhantomJS
//  Take the url passed in via command line and load it up in a PhantomJS web page
//  Measure the time it takes to load the url by starting a timer on page creation
//  and ending our timer on page load completion.
//  If the max_timeout is smaller than the page load time send a notification
//  via sms to recipients
//  Always complete by logging to Miyagi and exiting PhantomJS
var run_check = function(opts) {
    console.log("RunCheck; Create Browser");
    phantom.create(function(ph) {
        console.log("RunCheck; Create Page");
        ph.createPage(function(page) {
            console.log("RunCheck; Test URL: "+opts.url);
            var start_time = Date.now(),
                log = {
                    max_timeout   : opts.max_timeout,
                    log           : "PhantomJS",
                    load_time     : t,
                    timestamp     : start_time,
                    urgent        : false,
                    url           : opts.url
                };
            console.log("Checking "+opts.url);

            // Open our url from command line options
            
            page.set('viewportSize',{ width: 1024, height: 768 });
            page.open(opts.url, function (status) {
                log.http_status = status;
                
                console.log("Load status: "+status);

                if (status !== 'success') {
                    send_sms("Failed to load host: "+opts.url);
                    log.urgent = true;
                } else {
                    log.load_time = Date.now() - start_time
                    console.log('Loading time ' + log.load_time + ' ms. Status code: '+status);

                    // don't send out logs when checking all of the sites...
                    if(log.load_time>opts.max_timeout && !opts.check_all) {
                        log.urgent = true;
                        console.log("Timeout exceeds: "+opts.max_timeout);
                        send_sms("Slowdown Alert: "+log.load_time+"(ms) to load "+opts.url);
                    }
                }

                send_log(log);

                if(!log.urgent) {
                    setTimeout(function() {
                        var screenshot_name = opts.url.replace(/[^a-zA-Z0-9]+/g,'.');
                        store_screenshot(screenshot_name,page,ph)
                    },1500);
                } else {
                    kill_phantom(ph);
                }
            });
        });
    });
}

// Run CLI with no arguments and get back the input options
// Run CLI with a JSON string with any of the following options
if (process.argv.length < 3) {
    console.log('Usage: checkup.js \'{"url":"<some URL>", "max_timeout":"<(optional) milliseconds>"\'');
    console.log('If no URL is provided this tool will check all production transparency apps listed on opengov.com/customers!');
    process.exit(1);
} else {
    opts = JSON.parse(process.argv[2]);

    if(!opts.max_timeout) {
        // in milliseconds
        opts.max_timeout = 4500;
    } else {
        if(typeof opts.max_timeout == "string") {
            opts.max_timeout = parseInt(opts.max_timeout);
        }
    }

    console.log(opts);

    run_check(opts);
}
