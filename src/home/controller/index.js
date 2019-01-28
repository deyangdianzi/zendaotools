'use strict';

import Base from './base.js';
import CSV from 'fast-csv';
import fs from 'fs';
import xlsx from 'node-xlsx';
import config from '../config/config.js';

export default class extends Base {
  /**
   * index action
   * @return {Promise} []
   */


  indexAction() {
    //auto render template file index_index.html
    console.log('dudajiang1111');
    return this.display();
  }

  async detailAction() {
    console.log('dudajiang' + think.UPLOAD_PATH);
    let model = this.model('bi_report_amb_worklogtbymonth');
    let data = model.getTableName();
    console.log(JSON.stringify(data));
  }

  /**
   * 每天执行一次的批处理程序
   */
  async batchdoAction() {
    //先更新每个人当月的工时
    let self = this;
    let datestr = '2018-11-25';
    if (this.http.get('begindate')) {
      datestr = this.http.get('begindate');
    };
    self._reportobj = {
      reportdate: '2017-11-1',
      ds: new Map()
    };
    self._ambnamefromusermap = new Map(await this.getAmbNameFromUsername());
    self._ambnamefromproduct = new Map(await this.getAmbName());
    console.log(self._reportobj);
    await this.insertworklogbydayAction(datestr);

    await this.updateuserstoryoutputAction(datestr);

    await this.bugdetailAction();

    await this.newstorydetailAction();
    // console.log('日期',self._reportobj.reportdate);
    // for (let x of self._reportobj.ds) {
    //   console.log('阿米巴名称',x[0]);
    //   console.log('日报',x[1].worklogs.length);
    //   console.log('输出',x[1].outputs.length);
    //   console.log('错误输出',x[1].erroroutputs.length);
    //   console.log('新增bug',x[1].newbugs.length);
    //   console.log('错误bug',x[1].errnewbugs.length);
    //   console.log('完成bug',x[1].okbugs.length);
    //   console.log('新增需求',x[1].newstorys.length);
    //   console.log('错误需求',x[1].errnewstorys.length);
    //   console.log('完成需求',x[1].okstorys.length);      
    //   if (!x[0]){
    //     // console.log(JSON.stringify(x[1].worklogs));
    //   }
    //   // console.log(x.worklogs.length,'-',x.outputs.length,'-',x.erroroutputs.length);
    //   // console.log(x.newbugs.length,'-',x.errnewbugs.length,'-',x.okbugs.length);
    //   // console.log(x.newstorys.length,'-',x.errnewstorys.length,'-',x.okstorys.length);

    // }
  }

  /**
   * change action
   * 调用/www/input中的storydetail.csv文件，识别后更新到bi_report_amb_story表中
   * 如果发现有id，则进行更新，否则增加一行
   * @return {Promise} []
   */
  async changeAction() {
    let model = this.model('bi_report_amb_story');
    let filename = think.UPLOAD_PATH + '/storydetail.csv';
    console.log(filename);
    let stream = fs.createReadStream(filename);
    let arr = new Array();

    await CSV.fromStream(stream, { headers: true })
      .on("data", function (data) {
        arr.push(data);
      })
      .on("end", function () {
        console.log(" 读取 csv done！");
        console.log(arr.length);
        //将数组增加入库
        model.addMany(arr, {}, true);
      });
  }

  /**
     * 获取story详细报表(sql在config中是【需求详细报表】)，并做清洗处理，将其转换到bi_report_amb_story
     * 
     */
  async newstorydetailAction() {
    let storymodel = this.model('bi_report_amb_story');
    let sql = `select * from zentao.zt_story where id > 4230 `;
    // let sql = `select * from zentao.zt_story where id =2517`;
    let model = this.model('');
    //调试期间把数据先缓存一下，以免每次从数据库中取数据
    // let storydata = await think.cache('STORYDETAIL', () => {
    //   return model.db().query(sql);
    // });
    let storydata = await model.db().query(sql);
    // console.log(JSON.stringify(data));
    console.log(storydata.length);

    //先从现有的需求表中取现有的数据中endyear有值的为2017和2018的数据，
    let storybackdata = await storymodel.where('endyear > 0').select();
    // console.log(JSON.stringify(storybackdata));
    console.log(storybackdata.length);

    // details这个数组里面会存最后放到bi_report_amb_story里面的内容,errorstory 存放错误的数据内容写到excel中
    let details = [];
    let errorstory = [];
    let ambmap = new Map(await this.getAmbName());
    let productmap = new Map(await this.getProductId());
    let provincemap = new Map(await this.getProvinceId());
    let backupstory = [];
    let deletestory = [];

    // 从storydata取数据存放到data中
    let data = [];
    console.log('开始读取数据库......');

    for (let x of storydata) {
      //先判断该需求是否已经归档，如果归档就不处理了，直接跳过，否则才做进一步的分析
      if (x.deleted == 1) {
        deletestory.push(x);
        console.log('已删除', x.id);
      } else {
        let backbool = storybackdata.some((xx) => {
          return xx.id == x.id;
        });
        if (backbool) {
          backupstory.push(x);
          console.log('已归档', x.id);
        } else {
          let newst = {};
          newst.id = x.id;
          let tempdata = await model.db().query('select name from zentao.zt_product where id = ' + x.product);
          newst.product = tempdata[0] ? tempdata[0].name : null;
          newst.title = x.title;
          newst.createdate = x.openedDate;

          //需求分类、BSA分析、价值
          newst.storytype = this.changeStorytype(x.storytype);
          newst.storybsa = x.storybsa;
          newst.storyvaluelevel = x.storyvaluelevel;

          // 评审时间
          newst.reqreviewdate = x.reviewedDate;
          if (newst.reqreviewdate && newst.reqreviewdate != '0000-00-00 00:00:00' && newst.reqreviewdate != '0000-00-00') {
            newst.reqreviewflag = '完成';
          } else {
            newst.reqreviewflag = '未完成';
          };
          // 开发开始时间
          tempdata = await model.db().query(`SELECT min(openedDate) as minda FROM zt_task WHERE type in('design','devel') and story = ` + x.id);
          newst.devbegindate = tempdata[0] ? tempdata[0].minda : null;

          // 开发结束时间
          tempdata = await model.db().query(`SELECT myFunction(id) as devenddate FROM zt_story WHERE id = ` + x.id);
          newst.devenddate = tempdata[0] ? tempdata[0].devenddate : null;

          //开发结束标记
          if (newst.devenddate && newst.devenddate != '0000-00-00 00:00:00' && newst.devenddate != '0000-00-00') {
            newst.devendflag = '完成';
          } else {
            newst.devendflag = '未完成';
          };

          // 关闭时间
          newst.reqclosedate = x.closedDate;
          // 模块
          tempdata = await model.db().query(`select (select name from zt_product where id=zt_module.root) as module from zt_module where id=` + x.module);
          newst.module = tempdata[0] ? tempdata[0].module : null;

          // 关闭原因
          newst.reqclosereason = this.changeReason(x.closedReason);

          // 关闭标记
          if (newst.reqclosereason == '未关闭') {
            newst.reqcloseflag = '未完成';
          } else {
            newst.reqcloseflag = '完成';
          }
          // console.log('*****', newst.reqclosedate, newst.reqcloseflag);
          // if (newst.reqclosedate && newst.reqclosedate != '0000-00-00 00:00:00' && newst.reqclosedate != '0000-00-00') {
          //   let rq = new Date('2017-9-26 08:00:00');
          //   if (newst.reqclosedate == rq) {
          //     newst.reqcloseflag = '未完成';
          //   } else {
          //     newst.reqcloseflag = '完成';
          //   }
          // } else {
          //   newst.reqcloseflag = '未完成';
          // };

          // 创建者
          tempdata = await model.db().query(`select realname from zt_user where account = '` + x.openedBy + `'`);
          newst.reqcreater = tempdata[0] ? tempdata[0].realname : null;

          // 项目
          tempdata = await model.db().query(`select name from zt_project where id=(select project from zt_action where
        zt_action.objecttype='story' and zt_action.objectid=` + x.id + ` and zt_action.action='linked2project' order by date desc  limit 1)`);
          newst.project = tempdata[0] ? tempdata[0].name : null;

          let sqltemp = '';

          // 分支
          sqltemp = `select name from zt_branch where product = '` + x.product + `' and id = '` + x.branch + `'`;
          tempdata = await model.db().query(sqltemp);
          newst.branch = tempdata[0] ? tempdata[0].name : null;

          newst.deleted = x.deleted == 1 ? '已删除' : '正常';

          // 总有效输出
          sqltemp = `select sum(task_wp) as totalscore from bi_report_amb_dwbystoryuser where story = ` + x.id;
          tempdata = await model.db().query(sqltemp);
          newst.totalscore = tempdata[0] ? tempdata[0].totalscore : null;

          // 评审次数
          sqltemp = `select count(*) as reviewnum from zt_action where objectID = '` + x.id + `' and objectType = 'story' and action = 'reviewed'`;
          tempdata = await model.db().query(sqltemp);
          newst.reviewnum = tempdata[0] ? tempdata[0].reviewnum : 0;

          // 设计次数
          sqltemp = `select count(*) as designnum from zt_task where story = '` + x.id + `' and type = 'design'`;
          tempdata = await model.db().query(sqltemp);
          newst.designnum = tempdata[0] ? tempdata[0].designnum : 0;

          // 研发有效输出
          sqltemp = `select sum(task_wp) as designscore from bi_report_amb_dwbystoryuser where story = '` + x.id + `' and type = 'design'`;
          tempdata = await model.db().query(sqltemp);
          newst.designscore = tempdata[0] ? tempdata[0].designscore : null;

          // 任务数量
          sqltemp = `select count(id) as tasknum from zt_task where story = ` + x.id;
          tempdata = await model.db().query(sqltemp);
          newst.tasknum = tempdata[0] ? tempdata[0].tasknum : 0;

          // 工作时长
          sqltemp = `select sum(workloghour) as workloghour from bi_report_amb_worklog where storyid =` + x.id;
          tempdata = await model.db().query(sqltemp);
          newst.workloghour = tempdata[0] ? tempdata[0].workloghour : 0;

          console.log(newst.id);
          data.push(newst);
        }
      }
    };

    //
    console.log('开始执行删除......');
    for (let x of deletestory) {
      let affectedRows = await storymodel.where({ id: x.id }).delete();
      if (affectedRows > 0)
        console.log('删除需求id', x.id);
    }


    console.log('从数据库读取完毕，正在分析......');
    console.log('已经归档的数据......', backupstory.length);
    console.log('需要分析的数据......', data.length);

    for (let x of data) {
      let wrongflag = '有错误:';
      //确定产品
      if (x.product) {
        x.product = x.product.replace('【', '');
        x.product = x.product.replace('】', '');
      };

      //由于SDN、NFV的需求人员归属项目操作有问题，已经无法修改，所以对于SDN和NFV的要做特殊处理
      if (x.product == 'SDN' || x.product == 'NFV') {
        if (x.id < 5702) {
          x.project = null;
          x.branch = null;
        }
      }

      //确定省份
      let province = '';
      if (x.project) {
        province = x.project.replace('【', '');
        province = province.replace('】', '');
      } else {
        if (x.branch) {
          if (x.branch == '全国') {
            province = '公共';
          } else {
            province = x.branch;
          }
        } else {
          //根需求名字来进行判断         
          let name = x.title;
          let beginPro = name.indexOf('【');
          let endPro = name.indexOf('】');
          if ((beginPro == 0) && (endPro > beginPro) && (endPro < 6)) {
            let pro = name.substring(beginPro + 1, endPro);
            if (pro == '平台' || pro == '资源平台' || pro == '全国' || pro == '全国版本' || pro == '产品线' || pro == '产品线') {
              province = '公共';
            } else if (pro == '南基地' || pro == '南方基地') {
              province = '南方基地';
            } else if (pro == '联通网研') {
              province = '联通集团';
            } else {
              province = pro;
            }
          } else {
            // province = '公共';
            wrongflag += "|找不到归属省份(统计先归入公共)";
          };
        }
      };

      if (x.product == '广东本地化产品') {
        province = '广东';
      };
      if (x.product == '移动集团资源') {
        province = '移动集团';
      };

      //对几个特殊做处理
      if (x.product == 'SDN') {
        if (x.id > 4465 && x.id < 4479) {
          province = '公共';
        }
        if (x.id > 4563 && x.id < 4573) {
          province = '广东';
        }
      };
      if (x.id == 2672 || x.id == 2784) {
        province = '海南';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 3068 || x.id == 3166) {
        province = '吉林';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 2773) {
        province = '河南';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 2707 || x.id == 2709 || x.id == 2767 || x.id == 2718 || x.id == 3709 || x.id == 4479) {
        province = '公共';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 2763 || x.id == 2938) {
        province = '广东';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 3805) {
        province = '福建';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 3621) {
        province = '黑龙江';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 4524 || x.id == 3369 || x.id == 3600 || x.id == 4163) {
        province = '湖北';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 4691 || x.id == 3710 || x.id == 2863) {
        province = '联通集团';
        console.log('特殊分析***********', x.id);
      };
      if (x.id == 5264) {
        province = '广西';
        console.log('特殊分析***********', x.id);
      };
      x.province = province;
      x.wrongflag = wrongflag;

      if ((x.reqclosereason != '已完成') && (x.reqclosereason != '未关闭')) {
        x.devendflag = '完成';
        x.reqreviewflag = '完成';
        if ((!x.devenddate) || (x.devenddate == '0000-00-00 00:00:00')) {
          x.devenddate = x.reqclosedate;
        }
        if ((!x.devbegindate) || (x.devbegindate == '0000-00-00 00:00:00')) {
          x.devbegindate = x.devenddate;
        }
        if ((!x.reqreviewdate) || (x.reqreviewdate == '0000-00-00')) {
          x.reqreviewdate = x.devbegindate;
        }
        if (this.befordate(x.createdate, x.reqreviewdate)) {
          x.reqreviewdate = x.createdate;
        }
        if (this.befordate(x.reqreviewdate, x.devbegindate)) {
          x.devbegindate = x.reqreviewdate;
        }
        if (this.befordate(x.devbegindate, x.devenddate)) {
          x.devenddate = x.devbegindate;
        }
        if (this.befordate(x.devenddate, x.reqclosedate)) {
          x.devenddate = x.reqclosedate
        }

      } else if (x.reqclosereason === '已完成') {
        //已完成
        if (x.devendflag == '完成') {
          if (x.reqreviewflag == '未完成') {
            x.reqreviewflag = '完成';
            x.reqreviewdate = x.devbegindate;
          }
        } else {
          x.devendflag = '完成';
          x.devenddate = x.reqclosedate;
          if (x.reqreviewflag != '完成') {
            x.reqreviewflag = '完成';
            if ((!x.reqreviewdate) || (x.reqreviewdate == '0000-00-00') || this.befordate(x.createdate, x.reqreviewdate)) {
              x.reqreviewdate = x.createdate;
            }
          }
          if ((!x.devbegindate) || (x.devbegindate == '0000-00-00 00:00:00')) {
            x.devbegindate = x.reqreviewdate;
          }
        }
        if (this.befordate(x.createdate, x.reqreviewdate)) {
          x.reqreviewdate = x.createdate;
        }
        if (this.befordate(x.reqreviewdate, x.devbegindate)) {
          x.devbegindate = x.reqreviewdate;
        }
        if (this.befordate(x.devbegindate, x.devenddate)) {
          x.devenddate = x.devbegindate;
        }

      } else if (x.reqclosereason == '未关闭') {
        //未关闭
        x.reqclosedate = null;
        if (x.devendflag == '完成') {
          if (x.reqreviewflag == '未完成') {
            x.reqreviewdate = x.devbegindate;
            x.reqreviewflag = '完成';
          }
          if (this.befordate(x.createdate, x.reqreviewdate)) {
            x.reqreviewdate = x.createdate;
          }
          if (this.befordate(x.reqreviewdate, x.devbegindate)) {
            x.devbegindate = x.reqreviewdate;
          }
          if (this.befordate(x.devbegindate, x.devenddate)) {
            x.devenddate = x.devbegindate;
          }

        } else {
          x.devenddate = null;
          if (x.reqreviewflag == '完成') {
            if (this.befordate(x.createdate, x.reqreviewdate)) {
              x.reqreviewdate = x.createdate;
            }
          } else {
            x.reqreviewdate = null;
            if ((x.devbegindate) && (x.devbegindate != '0000-00-00 00:00:00')) {
              x.reqreviewflag = '完成';
              x.reqreviewdate = x.devbegindate;
              if (this.befordate(x.createdate, x.reqreviewdate)) {
                x.reqreviewdate = x.createdate;
              }
              if (this.befordate(x.reqreviewdate, x.devbegindate)) {
                x.devbegindate = x.reqreviewdate;
              }
            }
          }
        }
      }

      x.privince = x.province;

      x.reqcreater = this.changeName(x.reqcreater);

      x.createdate = this.changeDate(x.createdate);
      x.reqreviewdate = this.changeDate(x.reqreviewdate);
      x.devbegindate = this.changeDate(x.devbegindate);
      x.devenddate = this.changeDate(x.devenddate);
      x.reqclosedate = this.changeDate(x.reqclosedate);

      x.beginyear = this.getrealYear(x.createdate);
      x.endyear = this.getrealYear(x.reqclosedate);

      x.defamb = ambmap.get(x.product);
      x.productid = productmap.get(x.product);
      x.provinceid = provincemap.get(x.province);
      x.timelimit = this.getTimeLimit(x.createdate, x.reqclosedate, x.reqcloseflag, 1);

      //提示有问题的数据
      if (x.deleted == '正常') {
        if (x.defamb && x.province) {
          if (x.reqclosereason == '重复' || x.reqclosereason == '取消' || x.reqclosereason == '不做') {
            x.deleted = '删除';
          }
          details.push(x);
          // console.log(JSON.stringify(x));
          // 将清洗后的数据入库
          await storymodel.add(x, {}, true);
          // this.setReportObj(3,x);
        } else {
          errorstory.push(x);
          // this.setReportObj(3,x);
        }
      } else {
        //如果zt_story中删除，则将转换表中的也进行删除
        let affectedRows = await storymodel.where({ id: x.id }).delete();
        console.log('删除需求id', x.id);
      }
    };

    console.log(details.length, errorstory.length, JSON.stringify(errorstory));

    //将清洗后数据list（bugdetails）导出到excel中
    if (errorstory.length > 0) {
      let fileerrexcel = think.UPLOAD_PATH + '/' + this.getCurrentDay() + '需求详细列表的错误数据.xlsx';
      let arrerr = await this.exportDBListToExcel('bi_report_amb_story', errorstory, fileerrexcel);
      console.log(arrerr);
    }

    let fileexcel = think.UPLOAD_PATH + '/' + this.getCurrentDay() + '需求详细列表的正确数据.xlsx';
    let arr = await this.exportDBListToExcel('bi_report_amb_story', details, fileexcel);
    console.log(arr);

  };

  /**
   * 获取story详细报表(sql在config中是【需求详细报表】)，并做清洗处理，将其转换到bi_report_amb_story
   * （可以不用了）
   */
  async storydetailAction() {
    let storymodel = this.model('bi_report_amb_story');
    let sql = config.db['需求详细报表'];
    let datestr = '2016-11-30';
    let model = this.model('');
    let sql1 = model.parseSql(sql, datestr);

    //调试期间把数据先缓存一下，以免每次从数据库中取数据
    let data = await think.cache('STORYDETAIL', () => {
      return model.db().query(sql1);
    });
    // let data = await model.db().query(sql1);
    // console.log(JSON.stringify(data));
    console.log(data.length);
    //details这个数组里面会存最后放到bi_report_amb_story里面的内容
    let details = [];
    let errorstory = [];
    let ambmap = new Map(await this.getAmbName());

    for (let x of data) {
      let wrongflag = '有错误:';
      //确定产品
      if (x.product) {
        x.product = x.product.replace('【', '');
        x.product = x.product.replace('】', '');
      };
      //确定省份
      let province = '';
      if (x.project) {
        province = x.project.replace('【', '');
        province = province.replace('】', '');
      } else {
        if (x.branch) {
          province = x.branch;
        } else {
          //根据bug名字来进行判断
          let name = x.title;
          let beginPro = name.indexOf('【');
          let endPro = name.indexOf('】');
          if ((beginPro == 0) && (endPro > beginPro) && (endPro < 6)) {
            let pro = name.substring(beginPro + 1, endPro);
            if (pro == '平台' || pro == '资源平台' || pro == '全国' || pro == '全国版本') {
              province = '公共';
            } else if (pro == '南基地' || pro == '南方基地') {
              province = '南方基地';
            } else {
              province = pro;
            }
          } else {
            // province = '公共';
            wrongflag += "|找不到归属省份(统计先归入公共)";
          }
        }
      };

      if (x.product == '广东本地化产品') {
        province = '广东';
      };
      if (x.product == '移动集团资源') {
        province = '移动集团';
      };
      if (x.product == 'SDN') {
        province = '公共';
      };

      //对几个特殊做处理
      if (x.id == 2672 || x.id == 2784) {
        province = '海南';
      };
      if (x.id == 3068 || x.id == 3166) {
        province = '吉林';
      };
      if (x.id == 2773) {
        province = '河南';
      };
      if (x.id == 2707 || x.id == 2709 || x.id == 2767) {
        province = '公共';
      };
      if (x.id == 2763) {
        province = '广东';
      };
      if (x.id == 3805) {
        province = '福建';
      };
      if (x.id == 3621) {
        province = '黑龙江';
      };
      if (x.id == 4524 || x.id == 3369) {
        province = '湖北';
      };
      if (x.id == 4691) {
        province = '联通集团';
      };
      x.province = province;
      x.wrongflag = wrongflag;

      if ((x.reqclosereason != '已完成') && (x.reqclosereason != '未关闭')) {
        x.devendflag = '完成';
        x.reqreviewflag = '完成';
        if ((!x.devenddate) || (x.devenddate == '0000-00-00 00:00:00')) {
          x.devenddate = x.reqclosedate;
        }
        if ((!x.devbegindate) || (x.devbegindate == '0000-00-00 00:00:00')) {
          x.devbegindate = x.devenddate;
        }
        if ((!x.reqreviewdate) || (x.reqreviewdate == '0000-00-00')) {
          x.reqreviewdate = x.devbegindate;
        }
        if (this.befordate(x.createdate, x.reqreviewdate)) {
          x.reqreviewdate = x.createdate;
        }
        if (this.befordate(x.reqreviewdate, x.devbegindate)) {
          x.devbegindate = x.reqreviewdate;
        }
        if (this.befordate(x.devbegindate, x.devenddate)) {
          x.devenddate = x.devbegindate;
        }
        if (this.befordate(x.devenddate, x.reqclosedate)) {
          x.devenddate = x.reqclosedate
        }

      } else if (x.reqclosereason === '已完成') {
        //已完成
        if (x.devendflag == '完成') {
          if (x.reqreviewflag == '未完成') {
            x.reqreviewflag = '完成';
            x.reqreviewdate = x.devbegindate;
          }
        } else {
          x.devendflag = '完成';
          x.devenddate = x.reqclosedate;
          if (x.reqreviewflag != '完成') {
            x.reqreviewflag = '完成';
            if ((!x.reqreviewdate) || (x.reqreviewdate == '0000-00-00') || this.befordate(x.createdate, x.reqreviewdate)) {
              x.reqreviewdate = x.createdate;
            }
          }
          if ((!x.devbegindate) || (x.devbegindate == '0000-00-00 00:00:00')) {
            x.devbegindate = x.reqreviewdate;
          }
        }
        if (this.befordate(x.createdate, x.reqreviewdate)) {
          x.reqreviewdate = x.createdate;
        }
        if (this.befordate(x.reqreviewdate, x.devbegindate)) {
          x.devbegindate = x.reqreviewdate;
        }
        if (this.befordate(x.devbegindate, x.devenddate)) {
          x.devenddate = x.devbegindate;
        }

      } else if (x.reqclosereason == '未关闭') {
        //未关闭
        x.reqclosedate = null;
        if (x.devendflag == '完成') {
          if (x.reqreviewflag == '未完成') {
            x.reqreviewdate = x.devbegindate;
            x.reqreviewflag = '完成';
          }
          if (this.befordate(x.createdate, x.reqreviewdate)) {
            x.reqreviewdate = x.createdate;
          }
          if (this.befordate(x.reqreviewdate, x.devbegindate)) {
            x.devbegindate = x.reqreviewdate;
          }
          if (this.befordate(x.devbegindate, x.devenddate)) {
            x.devenddate = x.devbegindate;
          }

        } else {
          x.devenddate = null;
          if (x.reqreviewflag == '完成') {
            if (this.befordate(x.createdate, x.reqreviewdate)) {
              x.reqreviewdate = x.createdate;
            }
          } else {
            x.reqreviewdate = null;
            if ((x.devbegindate) && (x.devbegindate != '0000-00-00 00:00:00')) {
              x.reqreviewflag = '完成';
              x.reqreviewdate = x.devbegindate;
              if (this.befordate(x.createdate, x.reqreviewdate)) {
                x.reqreviewdate = x.createdate;
              }
              if (this.befordate(x.reqreviewdate, x.devbegindate)) {
                x.devbegindate = x.reqreviewdate;
              }
            }
          }
        }
      }

      x.privince = x.province;

      x.reqcreater = this.changeName(x.reqcreater);

      x.createdate = this.changeDate(x.createdate);
      x.reqreviewdate = this.changeDate(x.reqreviewdate);
      x.devbegindate = this.changeDate(x.devbegindate);
      x.devenddate = this.changeDate(x.devenddate);
      x.reqclosedate = this.changeDate(x.reqclosedate);

      x.defamb = ambmap.get(x.product);

      //提示有问题的数据
      if (x.deleted == '正常') {
        if (x.defamb && x.province) {
          details.push(x);
          // console.log(JSON.stringify(x));
          // 将清洗后的数据入库
          await storymodel.add(x, {}, true);
        } else {
          errorstory.push(x);
        }
      }
    };

    console.log(details.length, errorstory.length, JSON.stringify(errorstory));

    //将清洗后数据list（bugdetails）导出到excel中
    if (errorstory.length > 0) {
      let fileerrexcel = think.UPLOAD_PATH + '/' + this.getCurrentDay() + '需求详细列表的错误数据.xlsx';
      let arrerr = await this.exportDBListToExcel('bi_report_amb_story', errorstory, fileerrexcel);
      console.log(arrerr);
    }

    let fileexcel = think.UPLOAD_PATH + '/' + this.getCurrentDay() + '需求详细列表的正确数据.xlsx';
    let arr = await this.exportDBListToExcel('bi_report_amb_story', details, fileexcel);
    console.log(arr);

  };

  /**
   * 先从报工表里面获取人员报工，
   * 计算和需求关联的任务数，以及在其上的报工时长，有效输出，并更新story表
   * （不用！）
   */
  async updatestoryAction() {
    let sql1 = `select count(id) as tasknum from zt_task where story = '%s'`;
    let sql2 = `select sum(workloghour) as workloghour from bi_report_amb_worklogstoryview where storyid = '%s'`;
    let model = this.model('bi_report_amb_story');
    let storymodel = this.model('bi_report_amb_story_backup3');
    let data = await model.limit(20000).select();
    for (let x of data) {
      let storyid = x.id;
      let countmodel = this.model('');
      let sql11 = countmodel.parseSql(sql1, storyid);
      let sql21 = countmodel.parseSql(sql2, storyid);
      let data1 = await countmodel.db().query(sql11);
      x.tasknum = data1[0].tasknum;
      let data2 = await countmodel.db().query(sql21);
      x.workloghour = data2[0].workloghour;
      await storymodel.add(x, {}, true);
    }

  }

  /**
   * 将数据库中的某个表的内容导出到excel中
   */
  async exportdbtoexcelAction() {
    let model = this.model('');
    // let wksql = `SELECT a.*,b.level FROM bi_report_amb_worklogtbymonth a ,bi_report_amb_accountbymonth b where a.month = b.month and a.name = b.name `;
    // let wksql = `SELECT * FROM bi_report_amb_fwworklogtbymonth order by id `;
    // let wksql = `SELECT * FROM bi_report_amb_dwbystoryuser  `;
    // let wksql = `SELECT name,position,defamb,count(name) 工作月,sum(worklog) 总工时,sum(unworklog) 总未报工,sum(overtime) 总加班 FROM bi_report_amb_accountbymonth  where month like '2017%' group by name `;
    // let wksql = `SELECT realname,sum(task_wp) 研发有效输出 FROM bi_report_amb_dwbystoryuser where pr_time > '2016-12-31' and pr_time < '2018-1-1' group by realname`;
    // let wksql = `SELECT  d.release_alias as 版本,c.name as 产品,b.name as 省份 ,count(a.id) as 需求数 FROM release_task a,kanban_lane b,product c ,sk.release d where  a.lane_id = b.id and a.product_id = c.id and a.release_id = d.id group by b.name,c.name,d.release_alias;`;
    // let wksql = `SELECT d.release_alias as 版本,c.name as 产品名称,b.name as 省份,a.id  FROM product_env_release a, project b,product c ,sk.release d 
    // where 
    // a.project_id = b.id and a.release_id = d.id and a.product_id = c.id and a.release_id > 0 `;
    // let wksql = `SELECT  
    // c.name as productname,
    // b.name as provincename,
    // a.rel_id as story,
    // a.rel_not_exists as flag,
    // a.name as storyname, 
    // d.release_alias 
    // FROM release_task a,kanban_lane b,product c ,sk.release d 
    // where a.lane_id = b.id and a.product_id = c.id and a.release_id = d.id 
    // and d.release_alias = '20180422' `;
    // let wksql = `select a.work_date,b.realname as username,a.task_id, a.work_time ,a.task_type 
    // from zentao.dw_worklog_sync a, zentao.zt_user b 
    // where a.work_date >'2018-5-25' and (a.task_type=1 or a.task_type=2 or a.task_type=3 ) and b.account=a.account `;
    // let wksql = ` select * from zentao.bi_report_amb_story where deleted = '正常' and reqcloseflag = '未完成' and province = '广西' union 
    // select * from zentao.bi_report_amb_story where deleted = '正常' and reqcloseflag = '完成' and reqclosedate >='2017-12-26'  and province = '广西' `;
    // let wksql = ` select * from zentao.bi_report_amb_worklogtbymonth where month > 201712`
    // let wksql = ` SELECT defamb,beginyear,endyear, count(*) as allnum FROM zentao.bi_report_amb_story where (endyear = 2018 or endyear = 0) group by defamb,beginyear,endyear `
    let wksql = ` SELECT defamb,beginyear,endyear, count(*) as allnum FROM zentao.bi_report_amb_story where (beginyear = 2017) group by defamb,beginyear,endyear `
    // let wksql = ` SELECT defamb,beginyear,endyear, count(*) as allnum FROM zentao.bi_report_amb_bug where (endyear = 2018 or endyear = 0) group by defamb,beginyear,endyear `
    // let wksql = ` SELECT defamb,beginyear,endyear, count(*) as allnum FROM zentao.bi_report_amb_bug where (beginyear = 2017) group by defamb,beginyear,endyear `
    let data1 = await model.db().query(wksql);
    let data = [];
    let p = 2016;
    let n = 2017;
    let no = 2018;
    let type = '需求';
    let tempall = {
      defamb : '综合资源',
      type : type,
      year : n,
      pred : 0,
      nowd : 0,
      afterd : 0
    }
    data1.forEach((x) => {
      let aa = data.filter(y=>{
        return y.defamb == x.defamb
      })
      console.log(x);
      if (aa.length > 0) {
        console.log(x.beginyear);
        if (x.beginyear == p) {
          aa[0].pred += x.allnum;
          tempall.pred += x.allnum;
        }
        if (x.beginyear == n && x.endyear == n) {
          aa[0].nowd += x.allnum;
          tempall.nowd += x.allnum;
        }
        if (x.beginyear == n && x.endyear == no) {
          aa[0].afterd += x.allnum;
          tempall.afterd += x.allnum;
        }
      }else{
        let newo = {
          defamb : x.defamb,
          type : type,
          year : n,
          pred : 0,
          nowd : 0,
          afterd : 0
        }
        if (x.beginyear == p) {
          newo.pred += x.allnum;
          tempall.pred += x.allnum;
        }
        if (x.beginyear == n && x.endyear == n) {
          newo.nowd += x.allnum;
          tempall.nowd += x.allnum;
        }
        if (x.beginyear == n && x.endyear == no) {
          newo.afterd += x.allnum;
          tempall.afterd += x.allnum;
        }
        data.push(newo)
      }

    });

    data.push(tempall);
    console.log(data);

    let fileexcel = think.UPLOAD_PATH + '/' + this.getCurrentDay() + '问题总数.xlsx';
    // let data = await model.select();
    let arr = await this.exportListToExcel(data, fileexcel);
    // let arr = await this.exportDBListToExcel('bi_report_amb_worklogtbymonth', data, fileexcel);
    console.log(arr);
  }


  /**
   * 识别csv，更新report_amb_worklogtbymonth
   * 更新对内报工的数据表
   */
  async insertworklogAction() {
    let model = this.model('bi_report_amb_worklogtbymonth');
    let filename = think.UPLOAD_PATH + '/worklogin.csv';
    console.log(filename);
    let stream = fs.createReadStream(filename);
    let arr = new Array();
    let monthmap = new Map();

    await CSV.fromStream(stream, { headers: true })
      .on("data", function (data) {
        let workloghour = (parseFloat(data.allworklog) + parseFloat(data.allunworklog)) * parseFloat(data.worklog);
        let month = data.month;
        monthmap.set(month, true);
        data.workloghour = workloghour;
        arr.push(data);
      })
      .on("end", function () {
        console.log(" 读取 csv done！");
        console.log(arr.length);
        console.log('******', JSON.stringify(monthmap));
        //将数组增加入库
        model.addMany(arr, {}, true);
      });

    //更新完报工表后，将制定月份的报工表中数据删除，并将数据进行导入
  }

  /**
     * 识别csv，更新bi_report_amb_accountbymonth
     * 更新人员信息
     */
  async updateaccountAction() {
    let model = this.model('bi_report_amb_accountbymonth');
    let filename = think.UPLOAD_PATH + '/userlist.csv';
    console.log(filename);
    let stream = fs.createReadStream(filename);
    let arr = new Array();

    await CSV.fromStream(stream, { headers: true })
      .on("data", function (data) {
        arr.push(data);
      })
      .on("end", function () {
        console.log(" 读取 csv done！");
        console.log(arr.length);
        //将数组增加入库
        model.addMany(arr, {}, true);
      });
  }

  /**
   * 识别csv，更新bi_report_amb_fwworklogtbymonth
   * 服务人力报工
   */
  async updatefwworklogAction() {
    let model = this.model('bi_report_amb_fwworklogtbymonth');
    let filename = think.UPLOAD_PATH + '/fwworklog.csv';
    console.log(filename);
    let stream = fs.createReadStream(filename);
    let arr = new Array();
    //每月对应的工作日
    var mday = new Map([['201701', 22],
    ['201702', 22],
    ['201703', 20],
    ['201704', 23],
    ['201705', 20],
    ['201706', 23],
    ['201707', 22],
    ['201708', 21],
    ['201709', 23],
    ['201710', 21],
    ['201711', 22],
    ['201712', 22]]);
    var mlevel = new Map([['一档', 1],
    ['二档', 2],
    ['三档', 3],
    ['四档', 4],
    ['五档', 5]]);
    let monthmap = new Map();

    let arrs = [];
    let i = 0;
    let j = -1;

    await CSV.fromStream(stream, { headers: true })
      .on("data", function (data) {
        let ndata = {};
        ndata.id = data.id;
        ndata.month = data.month;
        ndata.syb = data.syb;
        ndata.dept = data.dept;
        ndata.projid = data.projid;
        ndata.projname = data.projname;
        ndata.name = data.name;
        ndata.idcard = data.idcard;
        ndata.wkamb = data.wkamb;

        //计算工时
        let allday = mday.get(data.month);
        let worklog = (parseFloat(data.workday) / allday).toFixed(5);
        //转换档位
        let level = mlevel.get(data.level);
        //转换省份
        let dept = data.dept;
        let idx = dept.indexOf('服务');
        ndata.wkprivince = dept.substring(0, idx);

        let month = data.month;
        monthmap.set(month, true);
        ndata.worklog = worklog;
        ndata.level = level;

        if (i == 0) {
          let arr = [];
          j++;
          arrs.push(arr);
        }
        arrs[j].push(ndata);
        if (i++ > 2998) {
          i = 0;
        }
      })
      .on("end", async function () {
        console.log(" 读取 csv done！");
        console.log(arrs.length);
        for (var index = 0; index < arrs.length; index++) {
          var element = arrs[index];
          console.log('index', index, '-', element.length);
          await model.addMany(element, {}, true);
        }
        //将数组增加入库
        // model.addMany(arr, {}, true);
      });
  }

  /**
     * 识别storybsa.csv，更新bi_amb_storybsa --写于2017-9-26
     * 这是个临时表，将各位产品经理在excel中填写的9月底之前的所有需求所做的分类及BSA分析存到这个临时表中
     * 等zt_story这个表添加了3个字段后，就另外写一个程序将这个临时表的数据导入到zt_story中
     * 后续就可以这些信息通过newstorydetail导出来了
     * $lang->story->storyValueLevelList['A']         = 'A:20及以上';
$lang->story->storyValueLevelList['B']         = 'B:10-20（不含20）';
$lang->story->storyValueLevelList['C']         = 'C:5-10（不含10）';
$lang->story->storyValueLevelList['D']         = 'D:2-5（不含5）';
$lang->story->storyValueLevelList['E']         = 'E:0-2（不含2）';
     * --dudajiag 2017-9-26
     */
  async storybsaAction() {
    let model = this.model('bi_amb_storybsa');
    let filename = think.UPLOAD_PATH + '/storybsa.csv';
    console.log(filename);
    let stream = fs.createReadStream(filename);
    let arr = new Array();

    await CSV.fromStream(stream, { headers: true })
      .on("data", function (data) {
        let valuenum = parseFloat(data.valuenum);
        let value = '';
        if (valuenum >= 20) {
          value = 'A';
        } else if (valuenum >= 10) {
          value = 'B';
        } else if (valuenum >= 5) {
          value = 'C';
        } else if (valuenum >= 2) {
          value = 'D';
        } else if (valuenum > 0) {
          value = 'E';
        } else {
          value = '';
        };
        data.value = value;
        arr.push(data);
      })
      .on("end", function () {
        console.log(" 读取 csv done！");
        console.log(arr.length);
        //将数组增加入库
        model.addMany(arr, {}, true);
      });
  }

  /**
   * 将数据库中的某个表的内容导出到excel中
   */
  async updatestoryfrombsaAction() {
    let model = this.model('zt_story');
    let data = await model.where('id > 2517').select();

    let arr = [];

    for (let x of data) {
      let id = x.id;
      let bsasql = `select * from bi_amb_storybsa where id = ` + id;
      let bsadata = await model.db().query(bsasql);
      if (bsadata[0]) {
        let storytype = '';
        switch (bsadata[0].type) {
          case '维护':
            storytype = 'maintenance';
            break;
          case '流程':
            storytype = 'flow';
            break;
          case '报表':
            storytype = 'report';
            break;
          case '接口':
            storytype = 'interface';
            break;
          case '其它':
            storytype = 'other';
            break;
          default:
            break;
        };
        let updateobj = {};
        updateobj.storytype = storytype;
        updateobj.storybsa = bsadata[0].bsa;
        updateobj.storyvaluelevel = bsadata[0].value;
        let updatewhere = {
          id: x.id
        };
        let affectedRows = await model.where(updatewhere).update(updateobj);
        console.log(affectedRows);
      } else {
        console.log('没有查询到');
      }
    };
  }

  /**
   * 将对外上报的CSV文件，转换成excel文件
   */
  async changeworklogtoexcelAction() {
    let filename = think.UPLOAD_PATH + '/worklogout.csv';
    let fileexcel = think.UPLOAD_PATH + '/上报公司阿米巴报工数据（综合资源正式）.xlsx';
    let filename2 = think.UPLOAD_PATH + '/worklogout-waibao.csv';
    let fileexcel2 = think.UPLOAD_PATH + '/上报公司阿米巴报工数据（综合资源外包）.xlsx';
    let stream = fs.createReadStream(filename);
    let stream2 = fs.createReadStream(filename2);
    let arr = new Array();
    let arr2 = new Array();

    CSV.fromStream(stream)
      .on("data", function (data) {
        arr.push(data);
      })
      .on("end", function () {
        console.log(" 读取 csv done！");
        console.log(arr.length);
        var buffer = xlsx.build([{
          name: 'work',
          data: arr
        }]); // Returns a buffer
        fs.writeFileSync(fileexcel, buffer, {
          'flag': 'w'
        });
      });

    CSV.fromStream(stream2)
      .on("data", function (data) {
        arr2.push(data);
      })
      .on("end", function () {
        console.log(" 读取 csv done！");
        console.log(arr2.length);
        var buffer = xlsx.build([{
          name: 'work',
          data: arr2
        }]); // Returns a buffer
        fs.writeFileSync(fileexcel2, buffer, {
          'flag': 'w'
        });
      });
  }

  /**
    * 利用内部报工数据，更新账户表里面的三个工时数据
    */
  async updateworklogAction() {
    let worklogMonth = new Map([
      ["201701", "168"],
      ["201702", "120"],
      ["201703", "160"],
      ["201704", "168"],
      ["201705", "168"],
      ["201706", "160"],
      ["201707", "176"],
      ["201708", "184"],
      ["201709", "168"],
      ["201710", "144"],
      ["201711", "176"],
      ["201712", "168"],
      ["201801", "176"],
      ["201802", "104"],
      ["201803", "160"],
      ["201804", "176"],
      ["201805", "168"],
      ["201806", "160"],
      ["201807", "176"],
      ["201808", "176"],
      ["201809", "168"],
      ["201810", "152"],
      ["201811", "168"],
      ["201812", "176"]
    ]);
    let http = this.http;
    let modelworklog = this.model('bi_report_amb_worklogtbymonth');
    let modelaccount = this.model('bi_report_amb_accountbymonth');
    let month = http.get('month');
    let val = await modelworklog.group('month,name').select();
    let rtvals = val;
    if (month) {
      rtvals = val.filter((x) => {
        return x.month === month;
      });
    };
    console.log(month + ':查询' + rtvals.length);
    let i = 0;
    rtvals.forEach((x) => {
      let allwork = worklogMonth.get(x.month);
      let overtime = x.allworklog + x.allunworklog - allwork;
      let updateObj = {
        worklog: x.allworklog,
        unworklog: x.allunworklog,
        overtime: overtime
      };
      let whereObj = {
        month: x.month,
        name: x.name
      };
      let affectedRows = modelaccount.where(whereObj).update(updateObj);
      i++;
      console.log('更新完成:' + i + ' ' + x.month + '-' + x.name + '-' + x.allworklog + '-' + x.allunworklog + '-' + overtime);
    });
    console.log(rtvals.length);
  }

  /**
     * 识别userstoryoutput.csv，更新bi_report_amb_dwbystoryuser
     * 更新人员信息(可以不用了，可以直接从数据库查询后，然后直接入库)
     */
  async updateuserstoryoutputfromcsvAction() {
    let model = this.model('bi_report_amb_dwbystoryuser');
    let filename = think.UPLOAD_PATH + '/userstoryoutput.csv';
    console.log(filename);
    let stream = fs.createReadStream(filename);
    let arr = new Array();

    await CSV.fromStream(stream, { headers: true })
      .on("data", function (data) {
        console.log(data['pr_time']);
        let tt = new Date(data['pr_time']);
        console.log(tt);
        data['pr_time'] = tt.toLocaleString();
        arr.push(data);
        console.log(JSON.stringify(arr[0]));
      })
      .on("end", function () {
        console.log(" 读取 csv done！");
        console.log(arr.length);
        //将数组增加入库
        model.addMany(arr, {}, true);
      });
  }

  /**
   * dudajiang  -2017-9-28
   * 通过查询人力报工sql，获取当月的人力报工，写入到bi_report_amb_worklog这个表中，
   * 一行就写入一行，当月有效，
   * 一旦月底更新了bi_report_amb_worklogtbymonth，就需要将此表bi_report_amb_worklog中内容删除
   * 每次查询都从前一个26日开始查询
   */
  async insertworklogbydayAction(inputbegindate) {
    let sql = config.db['人力报工'];
    let datestr = '2016-12-25';
    if (this.http.get('begindate')) {
      datestr = this.http.get('begindate');
    } else if (inputbegindate.length) {
      datestr = inputbegindate;
    };
    let wherestr = "reportdate > '" + datestr + "'";
    let reporttype = ['', '需求', '任务', 'BUG'];
    let model = this.model('', 'mysql');
    let sql1 = model.parseSql(sql, datestr);
    let data = await model.db().query(sql1);

    let model2 = this.model('bi_report_amb_worklog');
    //调试期间先缓存一下，以免每次都从数据库中取
    // let data = await think.cache('STORYDWOUTPUT', () => {
    //   return model.db().query(sql1);
    // });
    let taskmap = new Map();
    let taskmodel = this.model('zt_task');
    let taskdata = await taskmodel.limit(40000).select();
    for (let x of taskdata) {
      taskmap.set(x.id, x.story);
    }

    let bugmap = new Map();
    let bugmodel = this.model('zt_bug');
    let bugdata = await bugmodel.limit(40000).select();
    for (let x of bugdata) {
      bugmap.set(x.id, x.story);
    }

    let arrs = [];
    let i = 0;
    let j = -1;

    for (let x of data) {
      let month = this.getrealMonth(x.work_date);
      let reportdate = new Date(x.work_date);
      let insertobj = {
        month: month,
        reportdate: reportdate.toLocaleString(),
        name: x.username,
        objectid: x.task_id,
        reporttype: reporttype[x.task_type],
        workloghour: x.work_time
      };
      let sql = '';
      let tempdata = null;
      if (x.task_type == 1) {
        insertobj.storyid = x.task_id;
      } else if (x.task_type == 3) {
        // sql = 'select story from zt_bug where id = ' + x.task_id;
        // tempdata = await model2.db().query(sql);
        // insertobj.storyid = tempdata[0] ? tempdata[0].story : 0;
        insertobj.storyid = bugmap.get(x.task_id) || 0;
      } else if (x.task_type == 2) {
        insertobj.storyid = taskmap.get(x.task_id) || 0;
        // sql = 'select story from zt_task where id = ' + x.task_id;
        // tempdata = await model2.db().query(sql);
        // insertobj.storyid = tempdata[0] ? tempdata[0].story : 0;
      };

      // console.log(insertobj);
      if (i == 0) {
        let arr = [];
        j++;
        arrs.push(arr);
      }
      // if (j == 1 && i > 2565 && i < 2570) {
      //   console.log(insertobj);
      //   arrs[j].push(insertobj);
      // }
      arrs[j].push(insertobj);
      //调用函数，处理insertobj
      // console.log(insertobj.name);
      // this.setReportObj(0, insertobj);
      if (i++ > 2998) {
        i = 0;
      }



    };

    let affectedRows = await model2.where(wherestr).delete();
    for (var index = 0; index < arrs.length; index++) {
      var element = arrs[index];
      console.log('index', index, '-', element.length);
      await model2.addMany(element, {}, false);
    }

    console.log('总数据', data.length);
    console.log(arrs.length);
    // console.log('*****', JSON.stringify(arrs));
    for (var index = 0; index < arrs.length; index++) {
      var element = arrs[index];
      console.log('index', index, '-', element.length);
    }


    console.log('删除:', affectedRows);



  }

  /**
   * 通过查询sql，获取到每个开发人员每次提交获得的有效输出，汇总后插入到report_amb_dwbystoryuser表中
   * 为了做后续统计，将每个任务及关联的需求（如果有的话）所关联的省份和产品关联出来，并做分析
   * 优先级
   * 1）需求的产品和省份
   * 2）任务的产品和省份
   * 3）如果都找不到，则单独处理
   */
  async updateuserstoryoutputAction(inputbegindate) {
    let sql = config.db['人员需求任务输出'];
    let datestr = '2017-11-25';
    if (this.http.get('begindate')) {
      datestr = this.http.get('begindate');
    } else if (inputbegindate.length) {
      datestr = inputbegindate;
    };
    let model = this.model('');
    let sql1 = model.parseSql(sql, datestr);
    console.log(sql1);
    let data = await model.db().query(sql1);
    //调试期间先缓存一下，以免每次都从数据库中取
    // let data = await think.cache('STORYDWOUTPUT', () => {
    //   return model.db().query(sql1);
    // });

    let rightlist = [];
    let errorlist = [];

    data.forEach((x) => {
      // console.log(x);
      x.pr_time = this.changeDate(x.pr_time);
      let product = '';
      let province = '';

      //先看是否在特殊表中的
      let errorpr = config.errorpr;
      let aa = errorpr.filter((it) => {
        return it.id == x.id;
      });
      if (aa[0]) {
        product = aa[0].product;
        province = aa[0].province;
        //有些feature名字写错了，在这里举行修正
        if (aa[0].task_id) {
          x.task_id = aa[0].task_id;
          x.type = aa[0].type;
          x.story = aa[0].story;
        }
      } else {
        if (x.storyproduct) {
          product = x.storyproduct;
        } else if (x.taskproduct) {
          product = x.taskproduct.replace('【', '');
          product = product.replace('】', '');
        }

        if (x.storyprovince) {
          province = x.storyprovince;
        } else if (x.taskprovince) {
          province = x.taskprovince.replace('【', '');
          province = province.replace('】', '');
        }
      }

      //有几个做特殊处理
      if (!product) {
        if (province == '广东') {
          product = '广东本地化产品';
        };
        if (province == '联通集团') {
          product = '联通集团资源';
        };
      }

      if (product && province) {
        x.product = product;
        x.province = province;
        rightlist.push(x);
        // this.setReportObj(1,x);
      } else {
        errorlist.push(x);
      }

    });

    console.log(rightlist.length, errorlist.length);
    if (errorlist.length > 0) {
      let fileexcel = think.UPLOAD_PATH + '/' + this.getCurrentDay() + '有效输出的错误数据.xlsx';
      let arr = await this.exportListToExcel(errorlist, fileexcel);
      console.log(arr);
    }

    let outputmodel = this.model('bi_report_amb_dwbystoryuser');
    outputmodel.addMany(rightlist, {}, true);

    let fileexcel1 = think.UPLOAD_PATH + '/' + this.getCurrentDay() + '有效输出的正确数据.xlsx';
    let arr1 = await this.exportDBListToExcel('bi_report_amb_dwbystoryuser', rightlist, fileexcel1);
    console.log(arr1, rightlist.length);


  }

  /**
   * 获取bug详细报表(sql在config中是【bug详细报表】)，并做清洗处理，将其转换到bi_report_amb_bug
   * 
   */
  async bugdetailAction() {
    let bugmodel = this.model('bi_report_amb_bug');
    let sql = config.db['bug详细报表'];
    let datestr = '2017-12-25';
    let model = this.model('');
    let sql1 = model.parseSql(sql, datestr);
    let data = await model.db().query(sql1);
    //调试期间先缓存一下，以免每次都从数据库中取
    // let data = await think.cache('BUGDETAIL', () => {
    //   return model.db().query(sql1);
    // });
    // console.log(JSON.stringify(data));
    //bugdetails这个数组里面会存最后放到bi_report_amb_bug里面的内容
    let bugdetails = [];
    let errorlist = [];
    let ambmap = new Map(await this.getAmbName());

    for (let x of data) {
      let wrongflag = '有错误:';
      //确定产品
      if (x.product) {
        x.product = x.product.replace('【', '');
        x.product = x.product.replace('】', '');
      };
      //确定省份
      let province = '';
      if (x.project) {
        province = x.project.replace('【', '');
        province = province.replace('】', '');
      } else {
        if (x.branch) {
          province = x.branch;
        } else {
          //根据bug名字来进行判断
          let name = x.name;
          let beginPro = name.indexOf('【');
          let endPro = name.indexOf('】');
          if ((beginPro == 0) && (endPro > beginPro) && (endPro < 6)) {
            let pro = name.substring(beginPro + 1, endPro);
            if (pro == '平台' || pro == '资源平台' || pro == '全国') {
              province = '公共';
            } else {
              province = pro;
            }
          } else {
            province = '公共';
            wrongflag += "|找不到归属省份(统计先归入公共)";
          }
        }
      };
      //对几个特殊做处理
      if (x.id == 16538) {
        province = '吉林';
      };

      if (x.id == 24836) {
        province = '移动集团';
      };

      if (x.id == 17210 || x.id == 25114 || x.id == 25115 || x.id == 25116 || x.id == 25117) {
        province = '上海';
      };

      if (x.id == 15226 || x.id == 18460 || x.id == 18682) {
        province = '南方基地';
      };

      let source = x.source;
      if (source == null || source == '') {
        if (province == '公共') {
          source = 'productline';
        } else {
          source = 'province';
        }
      }

      if (source == 'province') {
        x.source = '问题-现场';
        if (x.confirmflag == 0 || x.confirmflag == '' || x.confirmflag == null) {
          wrongflag += "|省端问题未确认";
        } else {
          if (x.rdresponser == null || x.rdresponser == '' || x.rdresponser == 'admin') {
            wrongflag += "|省端问题未回溯";
          }
        }
      } else {
        x.source = '问题-内部';
      }
      if (wrongflag == '有错误:') {
        wrongflag = '';
      }
      x.province = province;
      x.wrongflag = wrongflag;

      x.rdresponser = this.changeName(x.rdresponser);
      x.testresponser = this.changeName(x.testresponser);
      x.reqresponser = this.changeName(x.reqresponser);
      x.creater = this.changeName(x.creater);
      x.resolver = this.changeName(x.resolver);

      x.createdate = this.changeDate(x.createdate);
      x.confirmdate = this.changeDate(x.confirmdate);
      x.resolvedate = this.changeDate(x.resolvedate);
      x.closedate = this.changeDate(x.closedate);

      x.beginyear = this.getrealYear(x.createdate);
      x.endyear = this.getrealYear(x.closedate);
      x.timelimit = this.getTimeLimit(x.createdate, x.closedate, x.status, 2);

      x.defamb = ambmap.get(x.product);

      //提示有问题的数据
      if (x.defamb && x.province) {
        bugdetails.push(x);
        // console.log(JSON.stringify(x));
        // 将清洗后的数据入库
        await bugmodel.add(x, {}, true);
        // this.setReportObj(3,x);
      } else {
        errorlist.push(x);
      }

      if (x.id == 21092) {
        // console.log(JSON.stringify(x));
        // bugdetails.push(x);
      }
    };

    console.log(bugdetails.length, errorlist.length);

    //将清洗后数据list（bugdetails）导出到excel中
    if (errorlist.length > 0) {
      let fileexcelerr = think.UPLOAD_PATH + '/' + this.getCurrentDay() + 'bug详细列表的错误数据.xlsx';
      let arr = await this.exportListToExcel(errorlist, fileexcelerr);
      console.log(arr);
    }
    let fileexcel = think.UPLOAD_PATH + '/' + this.getCurrentDay() + 'bug详细列表的正确数据.xlsx';
    let arr = await this.exportDBListToExcel('bi_report_amb_bug', bugdetails, fileexcel);
    console.log(arr);
  };

  /**
   * 
   */
  async sprintbbsbatchAction() {

    // let months = ['201701', '201702', '201703', '201704', '201705', '201706', '201707', '201708', '201709', '201710', '201711'];
    let months = ['20190127'];
    for (let x of months) {
      await this.sprintbbsAction();
      await this.sprintbbsscoreAction();
    }
  }

  /**
   * 计算某个迭代的得分
   * @param {*} sprintid '20180422'
   */
  async sprintbbsscoreAction(sprintid) {
    let sprint = '';
    let modelsk = this.model('', 'mysql3');
    if (sprintid == null) {
      let sql = 'SELECT * FROM sk.release where end_time < date_sub(curdate(),interval -14 day) and num >0 order by year_str desc,num desc LIMIT 3';
      let sprintobj = await modelsk.db().query(sql);
      // console.log(JSON.stringify(sprintobj));
      sprint = sprintobj[0].release_alias;
    } else {
      sprint = sprintid
    }

    // sprint = '20190127';

    let modelczd = this.model('');
    let sql1 = 'SELECT defamb,ratioofsprintonline,ratioofreqverify,ratioofcompclose,reqlongunclose,buglongunclose FROM zentao.bi_report_amb_sprintbbs  where level = 4 and sprint = ' + sprint;
    let sprintrows = await modelczd.db().query(sql1);
    let sortdata = {
      '综合资源平台': 1,
      '综合资源开通': 2,
      '综合资源家客': 3,
      '综合资源创新': 4,
      '综合资源集团': 5,
      '综合资源广东': 6
    };
    let sprintobj = sprintrows.sort((x, y) => {
      return sortdata[x.defamb] - sortdata[y.defamb];
    });
    console.log(sprintobj);
    let excellist = [];
    sprintobj.forEach(x => {
      let row1 = {
        a: x.defamb + '指标',
        b: x.ratioofsprintonline,
        c: x.ratioofreqverify,
        d: x.ratioofcompclose,
        e: x.reqlongunclose,
        f: x.buglongunclose,
        g: '',
        h: ''
      };
      let row2 = {
        a: x.defamb + '得分',
        b: this.getScore(x.ratioofsprintonline, 0.4, 10, 0.8, 30, 0.95, 35),
        c: this.getScore(x.ratioofreqverify, 0.4, 10, 0.9, 20, 1, 25),
        d: this.getScore(x.ratioofcompclose, 0.2, 10, 0.4, 20, 0.5, 30),
        e: this.getScore(x.reqlongunclose, 20, 10, 10, 20, 5, 25, -1),
        f: this.getScore(x.buglongunclose, 10, 10, 5, 20, 2, 25, -1)
      }
      row2.g = row2.b + row2.c + row2.d + row2.e + row2.f;
      let money = sortdata[x.defamb] < 4 ? 6000 : 3000;
      row2.h = money * row2.g / 100;
      excellist.push(row1);
      excellist.push(row2);
    });
    let fileexcel1 = think.UPLOAD_PATH + '/' + sprint + '迭代发布各团队得分情况.xlsx';
    let arr1 = await this.exportListToExcel(excellist, fileexcel1);
    console.log(arr1);
  }

  getScore(v, l1, s1, l2, s2, l3, s3, plus = 1) {
    let ret = 0;
    let vv = v * plus;
    if (vv < l1 * plus) {
      ret = 0;
    } else if (vv >= l1 * plus && vv < l2 * plus) {
      ret = s1 + (s2 - s1) * (vv - l1 * plus) / (l2 * plus - l1 * plus);
    } else if (vv >= l2 * plus && vv < l3 * plus) {
      ret = s2;
    } else {
      ret = s3;
    }
    return ret;
  }


  /**
   * 整理每个迭代周期的关键指标
   * @param {*} sprintid '20180422'
   */
  async sprintbbsAction(sprintid) {
    let sprint = '';
    let sprintbefor = '';
    let modelsk = this.model('', 'mysql3');
    let modeldoit = this.model('', 'mysql4');
    let modelczd = this.model('');
    if (sprintid == null) {
      let sql1 = 'SELECT * FROM sk.release where end_time < date_sub(curdate(),interval -14 day) and num >0 order by year_str desc,num desc LIMIT 3';
      let sprintobj = await modelsk.db().query(sql1);
      // console.log(JSON.stringify(sprintobj));
      sprint = sprintobj[0].release_alias;
      sprintbefor = sprintobj[2].release_alias;
    }

    // sprint = '20190127';
    // sprintbefor = '20181230';

    console.log('开始进行本迭代的指标计算', sprint, sprintbefor);

    let sprintbbs = [];
    // sprintcontent中存放详细的内容
    let sprintcontent = [];
    let ambmap = new Map(await this.getAmbName());

    // 第一步：先从sk数据库中将product_env_release中的信息去除计算各个产品的版本发布和上线数量
    let sql1 = `SELECT d.release_alias as sprint,c.name as productname,b.name as provincename,a.status as status,a.release_name as release_name,count(e.id) as stcount 
    FROM product_env_release a, project b,product c ,sk.release d ,release_task e,kanban_lane f
    where 
    a.project_id = b.id and a.release_id = d.id and a.product_id = c.id and a.release_id > 0 
    and a.release_id = e.release_id and a.product_id = e.product_id and e.lane_id = f.id and f.name = b.name
    and d.release_alias <= '%s'
    group by d.release_alias,c.name,b.name,a.status`;
    let sql2 = modelsk.parseSql(sql1, sprintbefor);
    let releaseall = await modelsk.db().query(sql2);
    releaseall.forEach((x) => {
      let defamb = ambmap.get(x.productname);
      let so = {
        sprint: sprint,
        product: x.productname,
        province: x.provincename,
        defamb: defamb,
        level: 1,
        sprintall: 1,
        sprintonline: x.status == 1 ? 1 : 0,
        reqverify: 0,
        reqdoandpublish: 0,
        reqpublish: 0,
        reqallunclose: 0,
        reqlongunclose: 0,
        bugallunclose: 0,
        buglongunclose: 0
      };
      let to = sprintbbs.filter((y) => {
        return y.sprint == sprint && y.product == x.productname && y.province == x.provincename;
      });
      if (to.length > 0) {
        to[0].sprintall += so.sprintall;
        to[0].sprintonline += so.sprintonline;
      } else {
        sprintbbs.push(so);
      };

      // 把查询出来的结果每一天纳入到表中，方便查询
      // 1：上线的版本
      let itemname = '需求数量: ' + x.stcount;
      if (x.status == 1) {
        itemname += ' ' + '上线时间: ' + x.release_name;
      } else {
        itemname += ' ' + '尚未上线: ';
      };
      let itemcontent = {
        sprint: sprint,
        defamb: defamb,
        product: x.productname,
        province: x.provincename,
        type: 2,
        id: x.sprint,
        name: itemname
      }
      sprintcontent.push(itemcontent);

      if (x.status == 1) {
        let itemcontent1 = {
          sprint: sprint,
          defamb: defamb,
          product: x.productname,
          province: x.provincename,
          type: 1,
          id: x.sprint,
          name: itemname
        }
        sprintcontent.push(itemcontent1);
      }

    });

    // let sprintbbsreal = sprintbbs.filter((x)=>{
    //   return x.sprint <= sprintbefor && x.sprint > '20180101';
    // });

    // 第二步：根据看板的表，获得本次迭代中在当前迭代中，或者已经发布了需求数量
    // 3.1 看板中处于当前迭代中的需求（sort_no = 4）和已经完成的需求（sort_no = 5）
    sql2 = `select 
    (select name from product where product.id=a.product_id) as productname,
    d.name as provincename,
    c.rel_id as story,
    c.rel_not_exists as flag,
    b.sort_no as sort_no,
    c.name as storyname
    from kanban a, kanban_list b, task c,kanban_lane d
    where 
    a.kanban_type=1 and a.id=b.kanban_id and b.sort_no in(4,5) and 
    a.id=c.kanban_id and b.id=c.list_id and c.task_type=1 and 
    c.lane_id = d.id `;
    let storydoinganddone = [];
    if (this.getAfterDateFlag(sprint, 0)) {
      storydoinganddone = await modelsk.db().query(sql2);
    }
    storydoinganddone.forEach((x) => {
      console.log('执行sql2*********');
      if (x.flag == 2) {
        console.log('本需求已经取消，不计算', x.productname, x.provincename, x.story, x.storyname);
      } else {
        let defamb = ambmap.get(x.productname);
        let so = {
          sprint: sprint,
          product: x.productname,
          province: x.provincename,
          defamb: defamb,
          level: 1,
          sprintall: 0,
          sprintonline: 0,
          reqverify: 0,
          reqdoandpublish: 1,
          reqpublish: x.sort_no == 5 ? 1 : 0,
          reqallunclose: 0,
          reqlongunclose: 0,
          bugallunclose: 0,
          buglongunclose: 0
        };
        let to = sprintbbs.filter((y) => {
          return y.sprint == sprint && y.product == x.productname && y.province == x.provincename;
        });
        if (to.length > 0) {
          to[0].reqdoandpublish += so.reqdoandpublish;
          to[0].reqpublish += so.reqpublish;
        } else {
          sprintbbs.push(so);
        }

        // 把查询出来的结果每一天纳入到表中，方便查询
        let itemcontent = {
          sprint: sprint,
          defamb: defamb,
          product: x.productname,
          province: x.provincename,
          type: 4,
          id: x.story,
          name: x.storyname
        }
        sprintcontent.push(itemcontent);

        if (x.sort_no == 5) {
          let itemcontent1 = {
            sprint: sprint,
            defamb: defamb,
            product: x.productname,
            province: x.provincename,
            type: 5,
            id: x.story,
            name: x.storyname
          }
          sprintcontent.push(itemcontent1);
        }
      }
    });
    // 3.2 看板中已经发布到本迭代release_task中的需求
    sql1 = `SELECT  
    c.name as productname,
    b.name as provincename,
    a.rel_id as story,
    a.rel_not_exists as flag,
    a.name as storyname, 
    d.release_alias 
    FROM release_task a,kanban_lane b,product c ,sk.release d 
    where a.lane_id = b.id and a.product_id = c.id and a.release_id = d.id 
    and d.release_alias = '%s' `;
    sql2 = modelsk.parseSql(sql1, sprint);
    let storypublish = await modelsk.db().query(sql2);
    storypublish.forEach((x) => {
      // console.log(x.productname, x.provincename);
      if (x.flag == 2) {
        console.log('本需求已经取消，不计算', x.productname, x.provincename, x.story, x.storyname);
      } else {
        let defamb = ambmap.get(x.productname);
        let so = {
          sprint: sprint,
          product: x.productname,
          province: x.provincename,
          defamb: defamb,
          level: 1,
          sprintall: 0,
          sprintonline: 0,
          reqverify: 0,
          reqdoandpublish: 1,
          reqpublish: 1,
          reqallunclose: 0,
          reqlongunclose: 0,
          bugallunclose: 0,
          buglongunclose: 0
        };
        let to = sprintbbs.filter((y) => {
          return y.sprint == sprint && y.product == x.productname && y.province == x.provincename;
        });
        if (to.length > 0) {
          to[0].reqdoandpublish += so.reqdoandpublish;
          to[0].reqpublish += so.reqpublish;
        } else {
          sprintbbs.push(so);
        }

        let itemcontent = {
          sprint: sprint,
          defamb: defamb,
          product: x.productname,
          province: x.provincename,
          type: 4,
          id: x.story,
          name: x.storyname
        }
        sprintcontent.push(itemcontent);

        let itemcontent1 = {
          sprint: sprint,
          defamb: defamb,
          product: x.productname,
          province: x.provincename,
          type: 5,
          id: x.story,
          name: x.storyname
        }
        sprintcontent.push(itemcontent1);
      }
    });

    // 第二步：根据doit的表，获得本次迭代中已经进行了需求验证的需求数量
    sql1 = `select * from product_release where test_version_number = '%s' and story_ids <> '' `;
    sql2 = modeldoit.parseSql(sql1, sprint);
    let storyverify = await modeldoit.db().query(sql2);
    storyverify.forEach((x) => {
      // console.log(x.productname, x.provincename);
      let storystr = x.story_ids;
      let storys = storystr.split(',');
      storys.forEach((y) => {
        //y是需求id，将y这个id到sprintcontent中去寻找，如果发现type为4，id相同的就返回
        let findsprintcontent = sprintcontent.filter((z) => {
          return z.id == y && z.type == 3;
        });
        //如果找到了，说明做了同一个需求做了多次验证，直接跳过即可。
        if (findsprintcontent.length == 0) {
          // 如果没有找到，再找找这个需求是否在看板的列表中，如果在，则进行进一步的分析
          let findsprintcontent1 = sprintcontent.filter((z) => {
            return z.id == y && z.type == 4;
          });
          if (findsprintcontent1.length > 0) {
            let spt1 = findsprintcontent1[0];
            let to = sprintbbs.filter((z) => {
              return z.sprint == sprint && z.product == spt1.product && z.province == spt1.province;
            });
            if (to.length > 0) {
              to[0].reqverify += 1;
            }
            let itemcontent1 = {
              sprint: spt1.sprint,
              defamb: spt1.defamb,
              product: spt1.product,
              province: spt1.province,
              type: 3,
              id: spt1.id,
              name: '验证人：' + x.action_user
            }
            sprintcontent.push(itemcontent1);
          }
        }
      });
    });

    // 第四步：从禅道数据库中取得剩余的需求数量和问题数量
    sql2 = `select defamb,product,province,timelimit,count(id) as stcount from bi_report_amb_story where endyear = 0 
    group by product,defamb,province,timelimit `;
    let storyunclose = await modelczd.db().query(sql2);
    storyunclose.forEach((x) => {
      console.log(x.product, x.province);
      let longclose = 0;
      if (x.timelimit == 4) {
        longclose += x.stcount
      }
      let so = {
        sprint: sprint,
        product: x.product,
        province: x.province,
        defamb: x.defamb,
        level: 1,
        sprintall: 0,
        sprintonline: 0,
        reqverify: 0,
        reqdoandpublish: 0,
        reqpublish: 0,
        reqallunclose: x.stcount,
        reqlongunclose: longclose,
        bugallunclose: 0,
        buglongunclose: 0
      };
      let to = sprintbbs.filter((y) => {
        return y.sprint == sprint && y.product == x.product && y.province == x.province;
      });
      if (to.length > 0) {
        to[0].reqallunclose += so.reqallunclose;
        to[0].reqlongunclose += so.reqlongunclose;
      } else {
        sprintbbs.push(so);
      }
    });

    sql2 = `select defamb,product,province,timelimit,count(id) as stcount from bi_report_amb_bug where endyear = 0 
    group by product,defamb,province,timelimit `;
    let bugunclose = await modelczd.db().query(sql2);
    bugunclose.forEach((x) => {
      console.log(x.product, x.province);
      let longclose = 0;
      if (x.timelimit == 4) {
        longclose += x.stcount
      }
      let so = {
        sprint: sprint,
        product: x.product,
        province: x.province,
        defamb: x.defamb,
        level: 1,
        sprintall: 0,
        sprintonline: 0,
        reqverify: 0,
        reqdoandpublish: 0,
        reqpublish: 0,
        reqallunclose: 0,
        reqlongunclose: 0,
        bugallunclose: x.stcount,
        buglongunclose: longclose
      };
      let to = sprintbbs.filter((y) => {
        return y.sprint == sprint && y.product == x.product && y.province == x.province;
      });
      if (to.length > 0) {
        to[0].bugallunclose += so.bugallunclose;
        to[0].buglongunclose += so.buglongunclose;
      } else {
        sprintbbs.push(so);
      }
    });

    //把需求和问题的具体细节放到content表中
    sql2 = `select defamb,product,province,timelimit,id,title from bi_report_amb_story where endyear = 0`;
    let storydetailunclose = await modelczd.db().query(sql2);
    storydetailunclose.forEach((x) => {
      let itemcontent = {
        sprint: sprint,
        defamb: x.defamb,
        product: x.product,
        province: x.province,
        type: 6,
        id: x.id,
        name: x.title
      }
      sprintcontent.push(itemcontent);
      if (x.timelimit == 4) {
        let itemcontent1 = {
          sprint: sprint,
          defamb: x.defamb,
          product: x.product,
          province: x.province,
          type: 7,
          id: x.id,
          name: x.title
        }
        sprintcontent.push(itemcontent1);
      }

    });

    sql2 = `select defamb,product,province,timelimit,id,name from bi_report_amb_bug where endyear = 0`;
    let bugdetailunclose = await modelczd.db().query(sql2);
    bugdetailunclose.forEach((x) => {
      let itemcontent = {
        sprint: sprint,
        defamb: x.defamb,
        product: x.product,
        province: x.province,
        type: 8,
        id: x.id,
        name: x.name
      }
      sprintcontent.push(itemcontent);
      if (x.timelimit == 4) {
        let itemcontent1 = {
          sprint: sprint,
          defamb: x.defamb,
          product: x.product,
          province: x.province,
          type: 9,
          id: x.id,
          name: x.name
        }
        sprintcontent.push(itemcontent1);
      }
    });

    let delp = sprintbbs.filter((x) => {
      return x.product == '产品线公共';
    });

    delp.forEach((x) => {
      let ind = sprintbbs.indexOf(x);
      sprintbbs.splice(ind, 1);
    });

    let delcontent = sprintcontent.filter((x) => {
      return x.product == '产品线公共';
    });

    delcontent.forEach((x) => {
      let ind = sprintcontent.indexOf(x);
      sprintcontent.splice(ind, 1);
    });

    sprintbbs.forEach((x) => {
      if (x.level == 1) {
        let prodallind = this.getkpiitemindex(sprintbbs, x.sprint, x.product, '全国', x.defamb);
        sprintbbs[prodallind].level = 2;
        this.mergeobj(sprintbbs[prodallind], x);

        let ambproduct = x.defamb.replace('综合资源', '') + '全部产品';
        let ambind = this.getkpiitemindex(sprintbbs, x.sprint, ambproduct, x.province, x.defamb);
        sprintbbs[ambind].level = 3;
        this.mergeobj(sprintbbs[ambind], x);

        let amballind = this.getkpiitemindex(sprintbbs, x.sprint, ambproduct, '全国', x.defamb);
        sprintbbs[amballind].level = 4;
        this.mergeobj(sprintbbs[amballind], x);

        let plineind = this.getkpiitemindex(sprintbbs, x.sprint, '综合资源', x.province, '综合资源');
        sprintbbs[plineind].level = 5;
        this.mergeobj(sprintbbs[plineind], x);

        let plineallind = this.getkpiitemindex(sprintbbs, x.sprint, '综合资源', '全国', '综合资源');
        sprintbbs[plineallind].level = 6;
        this.mergeobj(sprintbbs[plineallind], x);
      }
    });

    sprintbbs.forEach((x) => {
      //需求-验证率
      if (x.reqdoandpublish > 0) {
        x.ratioofreqverify = (x.reqverify / x.reqdoandpublish).toFixed(3);
      } else {
        x.ratioofreqverify = 0;
      }
      //版本-上线率
      if (x.sprintall > 0) {
        x.ratioofsprintonline = (x.sprintonline / x.sprintall).toFixed(3);
      } else {
        x.ratioofsprintonline = 0;
      }
      //需求-完成剩余比
      if (x.reqallunclose > 0) {
        x.ratioofcompclose = (x.reqpublish / x.reqallunclose).toFixed(3);
      } else {
        x.ratioofcompclose = 0;
      }
    })

    // sprintbbs.forEach((x) => {
    //   console.log(x.sprint, x.defamb, x.product, x.province, x.sprintall, x.sprintonline, x.reqdoandpublish, x.reqpublish, x.reqallunclose, x.reqlongunclose, x.bugallunclose, x.buglongunclose);
    // })

    let outputmodel = this.model('bi_report_amb_sprintbbs');
    // console.log(JSON.stringify(sprintbbs));
    let deleterows = await outputmodel.where({ sprint: ['=', sprint] }).delete();
    let addrows = await outputmodel.addMany(sprintbbs, {}, true);
    console.log('bi_report_amb_sprintbbs变化情况', sprint, deleterows, addrows.length);
    let fileexcel = think.UPLOAD_PATH + '/' + sprint + '各版本发布情况.xlsx';
    let arr = await this.exportListToExcel(sprintbbs, fileexcel);
    console.log(arr);

    let outputmodel1 = this.model('bi_report_amb_sprintbbscontent');
    // console.log(JSON.stringify(sprintbbs));
    let deleterows1 = await outputmodel1.where({ sprint: ['=', sprint] }).delete();
    let addrows1 = await outputmodel1.addMany(sprintcontent, {}, true);
    console.log('bi_report_amb_sprintbbscontent变化情况', sprint, deleterows1, addrows1.length);
    let fileexcel1 = think.UPLOAD_PATH + '/' + sprint + '各版本发布详细情况.xlsx';
    let arr1 = await this.exportListToExcel(sprintcontent, fileexcel1);
    console.log(arr1);
  }
  /**
   * 
   */
  async statallbatchAction() {

    // let months = ['201701', '201702', '201703', '201704', '201705', '201706', '201707', '201708', '201709', '201710', '201711'];
    let months = ['201811'];
    for (let x of months) {
      await this.statallbymonthAction(x);
    }
  }

  /**
   * 按照产品进行整体的工作统计
   */
  async statallbymonthAction(month) {
    let beginandenddate = this.getBeginAndEndDate(month);
    let enddate = beginandenddate[1];
    // let storymodel = this.model('bi_report_amb_story');
    // let bugmodel = this.model('bi_report_amb_bug');
    // let dwmodel = this.model('bi_report_amb_dwbystoryuser');
    let model = this.model('');
    //SELECT product,province,get_status_bydate(reqclosedate,'2017-7-26') as reqcloseflag,count(id) FROM bi_report_amb_story where createdate < '2017-7-26' group by product,province,reqcloseflag;
    // let storystat = await storymodel.group('product,province,reqcloseflag').field('product,reqcloseflag,count(id) as total').select();
    // SELECT product,status,count(id) FROM bi_report_amb_bug group by product,status;
    // let bugstat = await bugmodel.group('product,status').field('product,status,count(id) as total').select();
    // SELECT product,sum(task_wp) FROM bi_report_amb_dwbystoryuser group by product;
    // let dwstat = await dwmodel.group('product').field('product,sum(task_wp) as total').select();

    let sql = '';

    sql = `SELECT product,province,get_status_bydate(reqclosedate,'%s') as reqcloseflag1,count(id) as total 
    FROM bi_report_amb_story 
    where createdate < '%s' and deleted = '正常' and (endyear = 2018 or endyear = 0) 
    group by product,province,reqcloseflag1`;
    let storysql = model.parseSql(sql, enddate, enddate);
    let storystat = await model.db().query(storysql);

    sql = `SELECT product,province,get_status2_bydate(resolvedate,closedate,'%s') as status1,count(id) as total 
    FROM bi_report_amb_bug 
    where createdate < '%s' and (endyear = 2018 or endyear = 0) 
    group by product,province,status1`;
    let bugsql = model.parseSql(sql, enddate, enddate);
    let bugstat = await model.db().query(bugsql);

    sql = `SELECT product,province, sum(task_wp) as total 
    FROM bi_report_amb_dwbystoryuser
    where pr_time < '%s' and pr_time > '2017-12-26 00:00:00'
    group by product,province`;
    let dwsql = model.parseSql(sql, enddate);
    let dwstat = await model.db().query(dwsql);

    sql = `SELECT 
    a.wkproduct as product,a.wkprivince as province,b.position as position,sum(a.worklog) as worklog,sum(a.workloghour) as workloghour 
    FROM bi_report_amb_worklogtbymonth a, bi_report_amb_accountbymonth b 
    where a.month = b.month and a.name = b.name and a.month <= %d and a.month > 201712
    group by wkproduct,position,province`;
    let wksql = model.parseSql(sql, month);
    let wkstat = await model.db().query(wksql);


    let list = [];
    let index = 0;
    storystat.forEach((x) => {
      index = this.getitemindex(list, x.product, x.province);
      if (x.reqcloseflag1 == '完成') {
        list[index].reqclose += x.total;
      } else {
        list[index].requnclose += x.total;
      }
      list[index].reqallnum += x.total;
    });

    bugstat.forEach((x) => {
      index = this.getitemindex(list, x.product, x.province);
      if (x.status1 == '已关闭') {
        list[index].bugclose = x.total;
      } else if (x.status1 == '激活') {
        list[index].bugactive += x.total;
      } else {
        list[index].bugreslove += x.total;
      }
      list[index].bugallnum += x.total;
    });

    dwstat.forEach((x) => {
      if (x.product != '二次研发_河南') {
        index = this.getitemindex(list, x.product, x.province);
        list[index].reqtotal += x.total;
      }
    });

    wkstat.forEach((x) => {
      index = this.getitemindex(list, x.product, x.province);
      list[index].workhour += x.workloghour;
      x.position = x.position.trim();
      switch (x.position) {
        case '研发':
          list[index].devman += x.worklog;
          break;
        case '技术':
          list[index].devman += x.worklog;
          break;
        case '业务':
          list[index].reqman += x.worklog;
          break;
        default:
          list[index].otherman += x.worklog;
          break;
      }
    });

    this.merge2product(list, '资源平台', '传输告警', 1, true);
    this.merge2product(list, '联通集团资源', '联通集团金融专网', 1, true);
    this.merge2product(list, '工程和测试', '公共', 1, true);
    this.merge2product(list, '工程和测试', '工程', 1, true);
    this.merge2product(list, '工程和测试', '测试', 1, true);

    this.mergeproductall(list, '联通集团资源', '联通集团', 1, true);
    this.mergeproductall(list, '移动集团资源', '移动集团', 1, true);

    //开始汇总
    let ambmap = new Map(await this.getAmbName());
    list.forEach((x) => {
      if (x.level == 1) {
        let defamb = ambmap.get(x.product);
        if (defamb == null) {
          console.log(x, '$$$$$$$$$$$$$$$$');
        }
        x.defamb = defamb;

        let prodallind = this.getitemindex(list, x.product, '全国');
        list[prodallind].level = 2;
        list[prodallind].defamb = defamb;
        this.mergeobj(list[prodallind], x);

        let ambproduct = defamb.replace('综合资源', '') + '全部产品';
        let ambind = this.getitemindex(list, ambproduct, x.province);
        list[ambind].level = 3;
        list[ambind].defamb = defamb;
        this.mergeobj(list[ambind], x);

        let amballind = this.getitemindex(list, ambproduct, '全国');
        list[amballind].level = 4;
        list[amballind].defamb = defamb;
        this.mergeobj(list[amballind], x);

        let plineind = this.getitemindex(list, '综合资源', x.province);
        list[plineind].level = 5;
        list[plineind].defamb = '综合资源';
        this.mergeobj(list[plineind], x);

        let plineallind = this.getitemindex(list, '综合资源', '全国');
        list[plineallind].level = 6;
        list[plineallind].defamb = '综合资源';
        this.mergeobj(list[plineallind], x);

      }

    })

    list.forEach((x) => {
      x.month = month;
      //问题数量除以需求数量，平均每个需求产生的问题数,以及每万分有效输出产生的问题数
      if (x.reqclose > 0) {
        x.rateofnum = (x.bugallnum / x.reqclose).toFixed(1);
      }

      if (x.reqtotal > 0) {
        x.rateofout = (x.bugallnum * 10000 / x.reqtotal).toFixed(1);
      }

      x.allman = x.devman + x.reqman + x.otherman;
      if (x.devman > 0) {
        x.aveoutdevman = x.reqtotal / x.devman;
        x.avebugdevman = x.bugallnum / x.devman;
      }
      x.devman = x.devman.toFixed(1);
      x.reqman = x.reqman.toFixed(1);
      x.otherman = x.otherman.toFixed(1);
      x.allman = x.allman.toFixed(1);
    })
    // console.log(JSON.stringify(list));
    let outputmodel = this.model('bi_report_amb_statall');
    outputmodel.addMany(list, {}, true);
    let fileexcel = think.UPLOAD_PATH + '/' + month + '产品维度的统计数据(按月).xlsx';
    let arr = await this.exportListToExcel(list, fileexcel);
    console.log(arr);
  }

  /**
   * 将广西的需求表导入到禅道数据库中
   */
  async loadgxstoryAction() {
    let tablehead = await this.getColumneName('bi_report_amb_gxstory');
    let tableheadmapen = new Map(tablehead);
    let tableheadmapcn = new Map();

    for (let it of tableheadmapen) {
      tableheadmapcn.set(it[1], it[0]);
    };

    let obj = xlsx.parse(think.UPLOAD_PATH + '/gxstory0909.xlsx');
    let excelObj = obj[0].data;
    let excelmapen = new Map();
    let flag = true;
    for (let i = 0; i < excelObj[0].length; i++) {
      let col = excelObj[0][i];
      let tablecolen = tableheadmapcn.get(col);
      if (tablecolen) {
        excelmapen.set(i, tablecolen);
      } else {
        flag = false;
        console.log('excel的首行名称有误', col);
        break;
      }
    }

    let storylists = [];
    // let thisday = this.getCurrentDay();
    let thisday = '20180909';

    let item = {};
    // item.month = '2018-5-15';
    // item.title = '家庭宽带资源退网审批流程';
    // item.id = 'GX-8888-160203-4-00044';
    // item.dept = '广西网络运营中心客户响应室';
    // item.introducer = '唐巍';
    // item.system = '综资家宽';
    // item.project = '投资项目';
    // item.status = '完成上线';
    // item.scale = '历史工单';
    // item.workload = 96;
    // item.reviewflag = '是';
    // item.devdept = '本地';
    // item.reqanalyendflag = '是';
    // item.devendflag = '是';
    // item.reqanalydate = '2016-03-29T12:09:35.999Z';
    // item.reqcomfirmdate = '2016-03-29T12:09:35.999Z';
    // item.reqonlinedate = '2016-03-29T12:09:35.999Z';
    // item.status2 = '需求实施';
    // item.dealer = '综合资源-家宽（亿阳开发）';
    // storylists.push(item);

    let outputmodel = this.model('bi_report_amb_gxstory');
    // console.log(JSON.stringify(storylists));
    // let deleterows = await outputmodel.where({ month: ['=', thisday] }).delete();

    for (let i = 1; i < excelObj.length; i++) {
      let lines = excelObj[i];
      let storyitem = {};
      storyitem.month = thisday;
      for (let j = 0; j < lines.length; j++) {
        let name = excelmapen.get(j);
        if (name) {
          storyitem[name] = lines[j];
          if ((name.substr(-4) == 'date') && (lines[j])) {
            let tdate = new Date(1900, 0, lines[j] - 1);
            storyitem[name] = tdate.toLocaleString();
          }
        }
      }
      //对每行做一些处理，如果status为空，则status = '用户环节'
      if (storyitem.status) {
        //可以做一些检查 pass
      } else {
        storyitem.status = '用户环节';
      }

      if (storyitem.title) {
        storyitem.title = storyitem.title.trim()
      }
      storylists.push(storyitem);
      await outputmodel.add(storyitem, {}, true);
    }

    // let outputmodel = this.model('bi_report_amb_gxstory');
    console.log(JSON.stringify(storylists[0]));
    // let deleterows = await outputmodel.where({ month: ['=', thisday] }).delete();
    // let addrows = await outputmodel.addMany(storylists, {}, true);

  }

  //把两个产品合在一起，如果delfalg为TRUE，则删除掉被合并的
  merge2product(list, product, name, level, delflag) {
    let dels = list.filter((x) => {
      return x.product == name && x.level == level;
    });
    dels.forEach((x) => {
      let index1 = this.getitemindex(list, product, x.province);
      let index2 = this.getitemindex(list, x.product, x.province);
      this.mergeobj(list[index1], list[index2]);
      if (delflag) {
        list.splice(index2, 1);
      }
    })
  }

  //把一个产品中的全部省份的合并到name（例如'全国'）中， 
  mergeproductall(list, product, name, level, delflag) {
    let dels = list.filter((x) => {
      return x.product == product && x.province != name && x.level == level;
    });
    dels.forEach((x) => {
      let index1 = this.getitemindex(list, product, name);
      let index2 = this.getitemindex(list, x.product, x.province);
      this.mergeobj(list[index1], list[index2]);
      if (delflag) {
        list.splice(index2, 1);
      }
    })
  }

  /**
   * 合并对象
   * @param {*} obj 
   * @param {*} delobj 
   */
  mergeobj(obj, delobj) {
    for (let prop in obj) {
      if (prop != 'product' && prop != 'level' && prop != 'defamb' && prop != 'province' && prop != 'sprint') {
        obj[prop] += delobj[prop];
      }
    }
  }

  getitemindex(list, product, province) {
    let aa = list.filter((x) => {
      return x.product == product && x.province == province;
    });
    let item = {};
    if (aa.length == 0) {
      item = {
        month: '',
        defamb: '',
        product: product,
        province: province,
        level: 1,
        requnclose: 0,
        reqclose: 0,
        bugactive: 0,
        bugreslove: 0,
        bugclose: 0,
        reqallnum: 0,
        reqtotal: 0,
        bugallnum: 0,
        devman: 0,
        reqman: 0,
        otherman: 0,
        allman: 0,
        workhour: 0,
        rateofnum: 0,
        rateofout: 0,
        aveoutdevman: 0,
        avebugdevman: 0
      };
      list.push(item);
    } else {
      item = aa[0];
    }
    return list.indexOf(item);
  }

  /**
   * 这是计算团队关键指标而用（需求验证率、版本上线率、超长需求、超长问题等）
   */
  getkpiitemindex(list, sprint, product, province, defamb) {
    let aa = list.filter((x) => {
      return x.product == product && x.province == province;
    });
    let item = {};
    if (aa.length == 0) {
      item = {
        sprint: sprint,
        product: product,
        province: province,
        defamb: defamb,
        level: 1,
        sprintall: 0,
        sprintonline: 0,
        reqverify: 0,
        reqdoandpublish: 0,
        reqpublish: 0,
        reqallunclose: 0,
        reqlongunclose: 0,
        bugallunclose: 0,
        buglongunclose: 0,
        ratioofreqverify: 0,
        ratioofsprintonline: 0,
        ratioofcompclose: 0
      };
      list.push(item);
    } else {
      item = aa[0];
    }
    return list.indexOf(item);
  }

  /**
   * 根据月份名字，得到该月的起始和终止时间，例如，201705，返回【2017-4-26，2017-5-26】
   * @param {*} str 例如'201705'
   */
  getBeginAndEndDate(str) {
    var year = str.substr(0, 4);
    var month = str.substr(4);

    var time = new Date();
    // var todaymonth = time.getMonth() + 1;
    var todaymonth = 12;
    var day = time.getDate();

    var endday = "";

    if ((parseInt(month) === todaymonth) && (day < 26)) {
      endday = year + "-" + month + "-" + day;
    } else if ((parseInt(month) === todaymonth + 1) && (day > 25)) {
      endday = year + "-" + todaymonth + "-" + day;
    } else {
      endday = year + "-" + month + "-26";
    }

    if (month === "01") {
      year = year - 1;
      month = 12;
    } else {
      month = month - 1;
      if (month < 10) {
        month = "0" + month;
      }
    }
    var beginday = year + "-" + month + "-26";
    return [beginday, endday];
  }

  /**
   * 根据sourceobj中对象中的时间，判断是否是targetdate，如果是，就计算该对象，如果不是，就跳过
   * @param {序号} index 0：报工 1：提交的有效输出 2：bug  3：需求
   * @param {判断的对象} sourceobj 
   */
  setReportObj(index, sourceobj) {
    let targetdate = this._reportobj.reportdate;
    let ds = this._reportobj.ds;
    let newtarget = {
      ambname: '',
      worklogs: [],
      outputs: [],
      erroroutputs: [],
      newbugs: [],
      errnewbugs: [],
      okbugs: [],
      newstorys: [],
      errnewstorys: [],
      okstorys: []
    };
    let reportdate = '';
    let closereportdate = '';
    switch (index) {
      case 0:
        reportdate = sourceobj.reportdate;
        if (reportdate) {
          reportdate = reportdate.split(' ')[0];
        }
        if (targetdate == reportdate) {
          // 根据username得到该人员对应的amb
          let ambname = this._ambnamefromusermap.get(sourceobj.name);
          let targetds = ds.get(ambname);
          if (targetds == null) {
            targetds = newtarget;
            targetds.ambname = ambname;
          }
          targetds.worklogs.push(sourceobj);
          this._reportobj.ds.set(ambname, targetds);
        }
        break;
      case 1:
        reportdate = sourceobj.pr_time;
        if (reportdate) {
          reportdate = reportdate.split(' ')[0];
        }
        if (targetdate == reportdate) {
          // console.log(targetdate, reportdate, '相同');
          // 根据产品名称得到该有效输出的阿米巴
          let ambname = this._ambnamefromproduct.get(sourceobj.product);
          let targetds = ds.get(ambname);
          if (targetds == null) {
            targetds = newtarget;
            targetds.ambname = ambname;
          }
          targetds.outputs.push(sourceobj);
          if (sourceobj.story == 0 && sourceobj.product != '产品线公共') {
            targetds.erroroutputs.push(sourceobj);
          }
          this._reportobj.ds.set(ambname, targetds);
        }
        break;
      case 2:
        reportdate = sourceobj.createdate;
        if (reportdate) {
          reportdate = reportdate.split(' ')[0];
        }
        closereportdate = sourceobj.closedate;
        if (closereportdate) {
          closereportdate = closereportdate.split(' ')[0];
        }
        // 新增bug
        if (targetdate == reportdate) {
          // console.log(targetdate, reportdate, '相同');
          // 根据产品得到该人员对应的amb
          let ambname = sourceobj.defamb;
          let targetds = ds.get(ambname);
          if (targetds == null) {
            targetds = newtarget;
            targetds.ambname = ambname;
          }
          targetds.newbugs.push(sourceobj);
          if (sourceobj.wrongflag) {
            targetds.errnewbugs.push(sourceobj);
          }
        };
        if (closereportdate == reportdate) {
          // console.log(targetdate, reportdate, '相同');
          // 根据产品得到该人员对应的amb
          let ambname = sourceobj.defamb;
          let targetds = ds.get(ambname);
          if (targetds == null) {
            targetds = newtarget;
            targetds.ambname = ambname;
          }
          targetds.okbugs.push(sourceobj);
          this._reportobj.ds.set(ambname, targetds);
        };
        break;
      case 3:
        reportdate = sourceobj.createdate;
        if (reportdate) {
          reportdate = reportdate.split(' ')[0];
        }
        closereportdate = sourceobj.reqclosedate;
        if (closereportdate) {
          closereportdate = closereportdate.split(' ')[0];
        }
        // 新增bug
        if (targetdate == reportdate) {
          // console.log(targetdate, reportdate, '相同');
          // 根据产品得到该人员对应的amb
          let ambname = sourceobj.defamb;
          let targetds = ds.get(ambname);
          if (targetds == null) {
            targetds = newtarget;
            targetds.ambname = ambname;
          }
          targetds.newstorys.push(sourceobj);
          if (!(sourceobj.province && sourceobj.defamb)) {
            targetds.errnewstorys.push(sourceobj);
          }
        };
        if (closereportdate == reportdate) {
          // console.log(targetdate, reportdate, '相同');
          // 根据产品得到该人员对应的amb
          let ambname = sourceobj.defamb;
          let targetds = ds.get(ambname);
          if (targetds == null) {
            targetds = newtarget;
            targetds.ambname = ambname;
          }
          targetds.okstorys.push(sourceobj);
          this._reportobj.ds.set(ambname, targetds);
        };
        break;
      default:
        break;
    }
  }

  /**
   * datestr2在datestr1之前的话，返回true，否则，返回false
   * @param {*} datestr1 
   * @param {*} datestr2 
   */
  befordate(datestr1, datestr2) {
    let ret = false;
    if (datestr1 && datestr2 && (datestr1 > datestr2)) {
      ret = true;
    };
    return ret;
  }

  /**
   * 处理一下名字
   * @param {*} name 
   */
  changeName(name) {
    let ret = name;
    if (ret) {
      let begin = ret.lastIndexOf('_旧账号');
      if (begin > -1) {
        ret = ret.substring(0, begin);
      }
    }
    return ret;
  };

  /**
   * 处理一下时间
   * @param {*} time 
   */
  changeDate(time) {
    let ret = time;
    if (ret == '0000-00-00 00:00:00' || ret === null) {
      ret = null;
    } else {
      let tt = new Date(ret);
      ret = tt.toLocaleString();
    }
    return ret;
  };

  /**
   * 返回真正的年份，如果是null，返回0
   * @param {*} workdate 
   */
  getrealYear(workdate) {
    let ret = 0;
    if (workdate) {
      if (new Date(workdate) < new Date('2017-12-26 00:00:00')) {
        ret = 2017;
      } else if (new Date(workdate) < new Date('2018-12-26 00:00:00')) {
        ret = 2018;
      } else {
        ret = 2019;
      }
    };
    return ret;
  }

  /**
   * 判断当前时间和指定时间str的后i天，哪天在前，哪天在后
   * 例如 str = ‘20180426’ i= ‘-2’
   * 如果今天是20180424（含）以后的某天，则返回false
   * 如果今天是20180423（含）之前的某天，则返回true
   * @param {*} str 
   * @param {*} i 
   */
  getAfterDateFlag(str, i) {
    let strYear = str.substring(0, 4);
    let strMonth = str.substring(4, 6);
    let strDay = str.substring(6);
    let strDate = strYear + '-' + strMonth + '-' + strDay;
    let t = new Date(strDate);
    t.setDate(t.getDate() + i);
    let today = new Date();
    console.log(t);
    console.log(today);
    if (t < today) {
      return false
    } else {
      return true;
    }
  }

  /**
   * 根据时间返回该日期所对应的month
   * 2017-9-25,返回 201709
   * 2017-9-26,返回 201710
   * 以此类推
   * @param {*} month 
   */
  getrealMonth(workdate) {
    let yy = workdate.getFullYear();
    let month = workdate.getMonth() + 1;
    if (workdate.getDate() > 25) {
      let realmonth = new Date(workdate);
      realmonth.setDate(realmonth.getDate() + 10);
      month = realmonth.getMonth() + 1;
      if (month == 1) {
        yy++;
      }
    };
    if (month < 10) {
      month = yy + '0' + month;
    } else {
      month = yy + '' + month;
    };
    return month;
  };
  /**
   * 将关闭原因转换成中文
   * @param {*} res 
   */
  changeReason(res) {
    let ret = '未关闭';
    switch (res) {
      case 'done':
        ret = '已完成';
        break;
      case 'duplicate':
        ret = '重复';
        break;
      case 'cancel':
        ret = '取消';
        break;
      case 'bydesign':
        ret = '设计如此';
        break;
      case 'willnotdo':
        ret = '不做';
        break;
      case 'postponed':
        ret = '延期';
        break;
      case 'subdivided':
        ret = '需求拆分';
        break;
      default:
        break;
    }
    return ret;
  };

  /**
   * 将需求分类转换成中文
   * @param {*} res 
   */
  changeStorytype(res) {
    let ret = '';
    switch (res) {
      case 'maintenance':
        ret = '维护类';
        break;
      case 'flow':
        ret = '流程类';
        break;
      case 'report':
        ret = '报表类';
        break;
      case 'interface':
        ret = '接口类';
        break;
      case 'other':
        ret = '其它类';
        break;
      default:
        break;
    }
    return ret;
  };

  /**
   * 得到两个时间的间隔之间的超时程度
   * 如果是已经关闭的，stage = '完成' 用enddate - begindate
   * 如果是未关闭的，stage = '未完成' 用now - begindate
   * @param {*} begindate 
   * @param {*} enddate 
   * @param {*} stage 
   * @param {*} type 需求：1 问题：2 
   */
  getTimeLimit(begindatestr, enddatestr, stage, type) {
    let begindate = new Date(begindatestr);
    let enddate = new Date();
    if (stage == '完成' || stage == '已关闭') {
      enddate = new Date(enddatestr);
    }
    let diffday = parseInt(Math.abs(enddate - begindate) / 1000 / 60 / 60 / 24);
    let ret = 0;
    if (type == 1) {
      if (diffday < 31) {
        ret = 1;
      } else if (diffday < 61) {
        ret = 2;
      } else if (diffday < 91) {
        ret = 3;
      } else {
        ret = 4;
      };
    } else {
      if (diffday < 3) {
        ret = 1;
      } else if (diffday < 8) {
        ret = 2;
      } else if (diffday < 15) {
        ret = 3;
      } else {
        ret = 4;
      };
    }

    return ret;
  }

  /**
   * 对数据库的操作做简单的测试
   */
  async testAction() {

    let reportdate = new Date('2017-10-17');
    let month = this.getrealMonth(reportdate);
    console.log(month);



    // let str = '王欢_旧账号';
    // let aa = '  ';
    // if (aa) {
    //   console.log(this.changeName(str));
    // }
    // let schema = await this.getAmbName('NFV');
    // let schemamap = new Map(schema);
    // let model = this.model('');
    // let username = '陈敬中';
    // let sql = 'SELECT * from bi_amb_temp where username = \'%s\'';
    // let sql1 = model.parseSql(sql, username);
    // console.log(sql1);

    // // // let data = await model.limit(10).select();
    // // // console.log(JSON.stringify(data));
    // let schema = await model.db().query(sql1);
    // console.log(JSON.stringify(schema));
    // console.log(schemamap.get('SDN'));
    // let jsonstr = [{ "foodid": "1", "foodname": "米线111", "foodurl": "/static/img/food/1.jpg" },
    // { "foodid": "100", "foodname": "比萨111", "foodurl": "/static/img/food/3.jpg" }];
    // // let affectedRows = await model.where({foodid:jsonstr[i].foodid}).update(jsonstr[i]);
    // let affectedRows = await model.addMany(jsonstr, {}, true);
    // console.log('序列：' + affectedRows);
    // //let affectedRows = await model.where({ name: 'thinkjs' }).update({ email: 'admin@thinkjs.org' });

    //  let data = await this.mydb().query('select COLUMN_NAME,COLUMN_COMMENT from information_schema.columns where table_name="bi_amb_temp1"');
    //  console.log(JSON.stringify(data));
    //  console.log(JSON.stringify(config.db));
    // this.mydb().query('SELECT * from bi_report_temp').then((data) => {
    //   console.log(JSON.stringify(data));
    // }).then(()=>{
    //   console.log('ok');
    // });

  }

  /**
   * 
   */
  async cacheAction() {
    // let schema = await this.getAmbName('NFV');
    // let schemamap = new Map(schema);

    // console.log(schemamap.get('SDN'));
    let schemamap = new Map([
      [1, 'one'],
      [2, 'two'],
      [3, 'three'],
    ]);
    for (let value of schemamap.values()) {
      console.log('###', value);
    }
    for (let value of schemamap.keys()) {
      console.log('$$$', value);
    }
    let headerValues = [...schemamap.keys()];
    console.log(headerValues);
  }

}