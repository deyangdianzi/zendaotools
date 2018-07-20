'use strict';
/**
 * db config
 * @type {Object}
 */
export default {
  type: 'mysql',
  adapter: {
    mysql: {
      host: '10.10.1.236',
      port: '4306',
      database: 'zentao',
      user: 'root',
      password: 'Boco123@182',
      prefix: '',
      encoding: 'utf8',
      log_sql: false,
      log_connect: true,
      cache: {
        on: true,
        type: '',
        timeout: 3600
      }
    },
    mysql200: {
      host: '10.12.3.192',
      type: 'mysql',
      port: '3306',
      database: 'itask',
      user: 'pm_oss',
      password: 'pm_oss',
      prefix: '',
      encoding: 'utf8',
      log_sql: true,
      log_connect: true,
      cache: {
        on: true,
        type: '',
        timeout: 3600
      }
    },
    mysql3: {
      host: '10.10.1.236',
      type: 'mysql',
      port: '3306',
      database: 'sk',
      user: 'root',
      password: 'Boco236',
      prefix: '',
      encoding: 'utf8',
      log_sql: true,
      log_connect: true,
      cache: {
        on: true,
        type: '',
        timeout: 3600
      }
    },
    mysql4: {
      host: '10.10.1.236',
      type: 'mysql',
      port: '4306',
      database: 'doit',
      user: 'root',
      password: 'Boco123@182',
      prefix: '',
      encoding: 'utf8',
      log_sql: true,
      log_connect: true,
      cache: {
        on: true,
        type: '',
        timeout: 3600
      }
    },
    mongo: {

    }
  }
};

