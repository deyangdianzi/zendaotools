
Application created by [ThinkJS](http://www.thinkjs.org)

## Install dependencies

```
npm install
```

## Start server

```
npm start
```

## Deploy with pm2

Use pm2 to deploy app on production enviroment.

```
pm2 startOrReload pm2.json
```

## 更新当月的工时（每天执行一次-00）

通过查询sql，获取到当月每个人的报工，汇总后插入到bi_report_amb_worklog表中
注意：当完成月度报工后，就需要个时间
    let datestr = '2017-09-25';
```
node www/production.js home/index/insertworklogbyday
```

## 更新每个人的任务对应的有效输出列表（每天执行一次-01）

通过查询sql，获取到每个开发人员每次提交获得的有效输出，汇总后插入到report_amb_dwbystoryuser表中

```
node www/production.js home/index/updateuserstoryoutput
```

## 获取bug详细列表，并将其清洗后入库（每天执行一次-02）

将数据清洗并更新到禅道数据库中（bi_report_amb_bug）

```
node www/production.js home/index/bugdetail
```

## 获取需求详细列表，并将其清洗后入库（每天执行一次-03）

将数据清洗并更新到禅道数据库中（bi_report_amb_story）

```
node www/production.js home/index/newstorydetail
```

## 更新用户信息（每月执行一次-01）

每个月信息更新后，将userlist.csv用户数据更新bi_report_amb_accountbymonth

```
node www/production.js home/index/updateaccount
```


## 更新内部报工（每月执行一次-02）

将/www/output中的worklogin.csv中的数据更新到禅道数据库中（report_amb_worklogtbymonth）

```
node www/production.js home/index/insertworklog
```

## 更新某个月份每个人的工时数据（每月执行一次-03）

内部报工完成后，需要利用报工数据更新bi_report_amb_accountbymonth表的三个工时数据

```
node www/production.js home/index/updateworklog?month=201708
```

## 更新统计值（每月执行一次-04）

更新完报工数据后，将每天做的三个任务执行一遍，接着执行统计整体的统计

```
node www/production.js home/index/statallbatch
```


## 阿米巴上报数据（每月执行一次-04）

每个月月初的时候，将内部生成的阿米巴上报数据worklogout.csv转换成excel文件给李杨

```
node www/production.js home/index/changeworklogtoexcel
```