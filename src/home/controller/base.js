'use strict';

import fs from 'fs';
import xlsx from 'node-xlsx';

export default class extends think.controller.base {
  /**
   * some base method in here
   */

  async getColumneName(tabname) {
    let keyname = 'TAB_COLUMNNAME_' + tabname;
    think.cache(keyname, null);
    let nameMap = await think.cache(keyname, async () => {
      let model = this.model('');
      let sql = 'SELECT column_name,column_comment from information_schema.columns where table_name="' + tabname + '"';
      let schema = await model.db().query(sql);
      let temp = new Map();
      schema.forEach((x) => {
        temp.set(x.column_name, x.column_comment || x.column_name);
      });
      console.log(JSON.stringify(temp));
      think.cache(keyname, temp);
      return temp;
    });
    return nameMap;
  }

  async getAmbName() {
    let keyname = 'AMBNAME1';
    let nameMap = await think.cache(keyname, async () => {
      let model = this.model('');
      console.log('***********');
      let sql = 'SELECT * from bi_product_amb';
      let schema = await model.db().query(sql);
      let temp = new Map();
      schema.forEach((x) => {
        temp.set(x.product, x.relatedAmb);
      });
      return temp;
    });
    return nameMap;
  }

  async getProductId() {
    let keyname = 'PRODUCTID';
    let nameMap = await think.cache(keyname, async () => {
      let model = this.model('');
      console.log('***********');
      let sql = "SELECT * FROM zt_product where deleted = '0'";
      let schema = await model.db().query(sql);
      let temp = new Map();
      schema.forEach((x) => {
        temp.set(x.name, x.id);
        let pname = x.name.replace('【', '');
        pname = pname.replace('】', '');
        temp.set(pname, x.id);
      });
      return temp;
    });
    return nameMap;
  }
  
  async getProvinceId() {
    let keyname = 'PROVINCEID1';
    let nameMap = await think.cache(keyname, async () => {
      let model = this.model('');
      console.log('***********');
      let sql = "SELECT * FROM zt_project where deleted = '0'";
      let schema = await model.db().query(sql);
      let temp = new Map();
      schema.forEach((x) => {
        temp.set(x.name, x.id);
        let pname = x.name.replace('【', '');
        pname = pname.replace('】', '');
        temp.set(pname, x.id);
      });
      return temp;
    });
    return nameMap;
  }

  async getAmbNameFromUsername() {
    let keyname = 'AMBNAMEFROMUSER';
    let nameMap = await think.cache(keyname, async () => {
      let model = this.model('');
      console.log('***********');
      let sql = 'SELECT * FROM bi_report_amb_accountbymonth order by month';
      let schema = await model.db().query(sql);
      let temp = new Map();
      schema.forEach((x) => {
        temp.set(x.name, x.defamb);
      });
      return temp;
    });
    return nameMap;
  }
  
  async exportDBListToExcel(tabname, datalist, filename) {
    let ret = '';
    try {
      let head = await this.getColumneName(tabname);
      let headmap = new Map(head);
      let dataarr = [];

      let itemhead = [];
      for (let it of headmap.values()) {
        itemhead.push(it);
      };
      dataarr.push(itemhead);
      datalist.forEach((x) => {
        let item = [];
        for (let it of headmap.keys()) {
          item.push(x[it]);
        }
        dataarr.push(item);
      });

      var buffer = xlsx.build([{
        name: 'work',
        data: dataarr
      }]); // Returns a buffer
      fs.writeFileSync(filename, buffer, {
        'flag': 'w'
      });
    } catch (error) {
      ret = '导出失败';
      return ret;
    }
    ret = filename + '导出成功';
    return ret;
  };

  async exportListToExcel(datalist, filename) {
    let ret = '';
    try {
      let dataarr = [];
      // console.log('###########');
      let itemhead = Object.keys(datalist[0]);
      // console.log(JSON.stringify(itemhead));
      
      dataarr.push(itemhead);
      datalist.forEach((x) => {
        let item = [];
        for (let it of itemhead) {
          item.push(x[it]);
        }
        dataarr.push(item);
      });
      // console.log(JSON.stringify(dataarr));
      var buffer = xlsx.build([{
        name: 'work',
        data: dataarr
      }]); // Returns a buffer
      fs.writeFileSync(filename, buffer, {
        'flag': 'w'
      });
      // console.log('###########');
    } catch (error) {
      
      ret = '导出失败';
      console.log(JSON.stringify(error),ret);
      return ret;
    }
    ret = filename + '导出成功';
    return ret;
  };

  getCurrentDay() {
    let date = new Date();
    let mm = date.getMonth() +1;
    return date.getFullYear() + "-" + mm + "-" + date.getDate();
  };


}