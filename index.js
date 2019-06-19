"use strict";
const aws = require('aws-sdk');
const mysql = require('mysql');
const moment = require('moment');
const limit = require('p-limit')(5);
const spawn = require('child_process').spawn;
const fs = require('fs');
const s3 = new aws.S3();

exports.handler = function(event, context, callback) {
  process.env.EXPORT_S3_PATH = dateString(process.env.EXPORT_S3_PATH || '');
  let ignoredDatabases = ['mysql', 'performance_schema', 'innodb', 'information_schema', 'sys', 'tmp'];
  let connection = mysql.createConnection({
    host: process.env.EXPORT_DB_HOST,
    user: process.env.EXPORT_DB_USERNAME,
    password: process.env.EXPORT_DB_PASSWORD,
    connectTimeout: 2000
  });

  connection.connect((err) => {
    if (err) {
      callback(`Error connecting to database: ${err} (host: ${process.env.EXPORT_DB_HOST}, user: ${process.env.EXPORT_DB_USERNAME})`);
      return;
    }
  });

  connection.query('SHOW DATABASES', function(err, databases) {
    (databases || [])
    .map((database) => {
    	return database.Database
    })
    .filter((database) => ignoredDatabases.indexOf(database) === -1)
    .map(backupDatabase)
    .forEach((promise) => {
      promise.then((message) => console.log(message));
      promise.catch((err) => console.error(err));
    });
  });

  connection.end();
}

/**
 *
 * @param template
 * @returns {string|XML}
 */
function dateString(template) {
  let date = moment();
  return template.replace(/%YYYY/, date.format('YYYY'))
  .replace(/%YY/, date.format('YY'))
  .replace(/%MM/, date.format('MM'))
  .replace(/%M/, date.format('M'))
  .replace(/%DD/, date.format('DD'))
  .replace(/%D/, date.format('D'));
}

/**
 * @param database
 * @returns {Promise}
 */
function backupDatabase(database) {
  return limit(() => {
    return new Promise(function(resolve, reject) {

      let env = Object.create(process.env);
      env.EXPORT_DB_NAME = database;
      console.log(`Exporting ${env.EXPORT_DB_NAME} to s3://${env.EXPORT_S3_PATH}/${env.EXPORT_DB_NAME}.gz`);
      let backup = spawn('./mysqldump-to-s3/export.sh', [''], {env: env})
      backup.stderr.on('data', (data) => {
        reject(data.toString());
      });

      backup.on('close', (code) => {
        if (code === 0) {
          resolve(`Successfully exported ${env.EXPORT_DB_NAME}`);

          fs.readFile(`/tmp/${env.EXPORT_DB_NAME}.sql`, function (err, data) {
            if (err) { throw err; }

            let params = {Bucket: `${env.EXPORT_S3_PATH}`, Key: `${env.EXPORT_DB_NAME}.sql`, Body: data };

               s3.putObject(params, function(err, data) {
                   if (err) {
                       console.log(err)
                   } else {
                       console.log(`Successfully uploaded data to ${env.EXPORT_S3_PATH}`);
                   }

                });

          });

          fs.readdir('/tmp', (err, files) => {
              files.forEach(file => {
              console.log("tmp:", file);
            });
          });

        } else {
          reject(`Error exporting ${code}: ${env.EXPORT_DB_NAME}`);
        }
      });
    });
  });
}
