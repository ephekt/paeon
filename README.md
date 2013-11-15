***This is not in production and is a prototype***

# Paeon
Site responsiveness checker.

## Description
Paeon is a routine checkup on the responsiveness (page load/rendering) of a web service. If the service is running slow then an SMS will be delivered to Developers. Logging for all checkups is done via Miyagi.


### Paeon Developer Notes

* Please search for `"FILL ME IN"` and update with the right codes.
* You will need to create in your S3 account a bucket named `product-screenshots` or change that string in the code!

#### Dependencies
* NodeJS (0.8x)
* Phantom (1.9x)
* PhantomJS
* TwilioJS
* Loggly

#### Service Dependencies
* Loggly
* Twilio

#### Dependency Installation
    [sudo] npm install

* You may need to install `apt-get install libfontconfig1` as well as `npm install -g phantomjs`

#####
Sample run with a specific URL:
  mikes-MacBook-Pro:Paeon mrose$ node checkup.js '{"max_timeout":4000,"url":"http://paloalto.delphi.us"}'
  { max_timeout: 4000, url: 'http://paloalto.delphi.us' }
  Loading time 3025 ms. Status code: success
  Storing screenshot for http.paloalto.delphi.us
  Snapping Screenshot
  Successfully uploaded file.
  Killing PhantonJS
  Log pushed to Loggly


## Author
Author(s): Michael Rosengarten

Collaborator(s): <Become one!>
