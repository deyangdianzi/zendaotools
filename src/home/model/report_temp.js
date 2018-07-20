'use strict';
/**
 * model
 */
export default class extends think.model.base {

  getSql(){
    let sql = 'SELECT * FROM __REPORT_TEMP__ WHERE foodid=%d';
    sql = this.parseSql(sql, 10);
    console.log(sql);
    //sql is SELECT * FROM think_group WHERE id=10
  }
}