'use strict';
/**
 * config
 */
export default {
  //key: value
  db: {
    '任务列表': `SELECT id AS 禅道编号,
    (select name from zt_project where id=zt_task.project) as 所属项目 ,
    (select (select name from zt_product where id=zt_module.root) from zt_module where id=zt_task.module) as 所属模块,
    (CASE
    WHEN type='design'
    THEN '研发-设计'
    WHEN type='devel'
    THEN '研发-开发'
    WHEN type='bugfix'
    THEN '研发-bug处理'
    WHEN type='bug'
    THEN '研发-bug处理'
    WHEN type='model'
    THEN '研发-模型变更'
    WHEN type='reqmeeting'
    THEN '研发-需求评审'
    WHEN type='support'
    THEN '研发-支撑'
    WHEN type='req-1'
    THEN '需求-需求调研'
    WHEN type='req-2'
    THEN '需求-规划分析'
    WHEN type='req-3'
    THEN '需求-需求评审'
    WHEN type='req-4'
    THEN '需求-需求验证'
    WHEN type='req-5'
    THEN '需求-售前支持'
    WHEN type='test'
    THEN '测试-系统测试'
    WHEN type='test-1'
    THEN '测试-用例编写'
    WHEN type='test-2'
    THEN '测试-需求评审'
    WHEN type='pub'
    THEN '公共-事务'
    WHEN type='deploy'
    THEN '工程-项目实施'
    WHEN type='check'
    THEN '工程-验收'
    WHEN type='study'
    THEN '学习'
    WHEN type='per'
    THEN '个人-事务'
    ELSE ' 其他'
    END
    ) AS 任务类型,
    openedDate AS 任务创建时间
    FROM ZT_TASK`,
    '需求详细报表': `select id as id,
(select name from zt_product where id=zt_story.product) as product,
title as title,
openedDate as createdate,
reviewedDate as reqreviewdate,
(case when reviewedDate ='0000-00-00 00:00:00' then '未完成'  when null then '未完成' else '完成' end) as reqreviewflag,
myFunction2(id) as devbegindate,
myFunction(id) as devenddate,
(case when myFunction(id) !='0000-00-00 00:00:00' then '完成' else '未完成' end) as devendflag,
closedDate as reqclosedate,
(case when closedDate ='0000-00-00 00:00:00' then '未完成' when null then '未完成' else '完成' end) as reqcloseflag,
(select (select name from zt_product where id=zt_module.root) from zt_module where id=zt_story.module) as module,
(CASE
WHEN closedreason='done'
THEN '已完成'
WHEN closedreason='duplicate'
THEN '重复'
WHEN closedreason='cancel'
THEN '取消'
WHEN closedreason='bydesign'
THEN '设计如此'
WHEN closedreason='willnotdo'
THEN '不做'
WHEN closedreason='postponed'
THEN '延期'
ELSE '未关闭'
END
) AS reqclosereason,
 (select realname from zt_user where account=zt_story.openedBy) as reqcreater,
     (select name from zt_project where id=(select project from zt_action where
    zt_action.objecttype='story' and zt_action.objectid=zt_story.id and zt_action.action='linked2project' order by date desc  limit 1)) as project,
    (select name from zt_branch where product =zt_story.product and id=zt_story.branch) as branch,
     (CASE WHEN deleted = 1 THEN '正常' ELSE '已删除' END) as deleted,
     (select sum(task_wp) from bi_report_amb_dwbystoryuser where story = zt_story.id) as totalscore,
     (select count(*) from zt_action where objectID = zt_story.id and objectType = 'story' and action = 'reviewed' ) as reviewnum,
     (select count(*) from zt_task where story = zt_story.id and type = 'design' ) as designnum,
     (select sum(task_wp) from bi_report_amb_dwbystoryuser where story = zt_story.id and type = 'design') as designscore,
     (select count(id) as tasknum from zt_task where story = zt_story.id) as tasknum,
     (select sum(workloghour) as workloghour from bi_report_amb_worklogstoryview where storyid = zt_story.id) as workloghour
    from zt_story
    where openeddate >'%s'`,
    '需求列表': `select id as 需求编号,
    (select name from zt_product where id=zt_story.product) as 所属产品,
    (select name from zt_project where id=(select project from zt_action where
    zt_action.objecttype='story' and zt_action.objectid=zt_story.id and zt_action.action='linked2project' order by date desc  limit 1)) as 所属项目,
    (select name from zt_branch where product =zt_story.product and id=zt_story.branch) as 所属分支,
    title as 需求名称,
    openedDate as 需求创建时间
    from zt_story`,
    'bug列表': `select id as bug编号,
     (select name from zt_product where id=zt_bug.product) as 所属产品 ,
     (select name from zt_project where id=zt_bug.project) as 所属省份 ,
     title as bug名称,
     (select realname from zt_user where account=zt_bug.resolvedBy)   as 处理人,
     source
     from zt_bug`,
    'bug详细报表': `select id as id,
     (select name from zt_product where id=zt_bug.product) as product ,
     (CASE
WHEN status='active'
THEN '激活'
WHEN status='resolved'
THEN '解决'
WHEN status='closed'
THEN '已关闭'
ELSE '未知'
END
) AS status,
     (select (select name from zt_product where id=zt_module.root) from zt_module where id=zt_bug.module) as module,
     (select name from zt_branch where product =zt_bug.product and id=zt_bug.branch) as branch,
     (select name from zt_project where id=zt_bug.project) as project ,
     title as name,
     type as type,
     source as source,
     (select realname from zt_user where account=zt_bug.rdresponser)   as rdresponser,
     (select realname from zt_user where account=zt_bug.testresponser)   as testresponser,
     (select realname from zt_user where account=zt_bug.reqresponser)   as reqresponser,
     (select realname from zt_user where account=zt_bug.openedBy)   as creater,
     openedDate as createdate,
     (SELECT (select realname from zt_user where account=zt_action.actor) FROM zt_action where objectid =zt_bug.id and action = 'bugconfirmed' limit 1)   as confirmeder,
     (SELECT date FROM zt_action where objectid =zt_bug.id and action = 'bugconfirmed' limit 1)   as confirmdate,
     confirmed as confirmflag,
     (select realname from zt_user where account=zt_bug.resolvedBy)   as resolver,
     resolvedDate as resolvedate,
     closedDate as closedate,
     deleted as deleted
     from zt_bug where openedDate > '%s' and deleted = '0'`,
    '人员需求任务输出': `SELECT  PR.id,U.realname,PR.pr_time,PR.task_id,T.task_wp ,TASK.story,TASK.type,
     (select name from zt_project where id=TASK.project) as taskprovince ,
    (select (select name from zt_product where id=zt_module.root) from zt_module where id=TASK.module) as taskproduct,
    (select province from bi_report_amb_story where id = TASK.story) as storyprovince,
    (select product from bi_report_amb_story where id = TASK.story) as storyproduct
FROM DW_GITLAB_PR PR,ZT_USER U,ZT_TASK TASK,
(
SELECT C.RELATED_PR_CUID,SUM(C.LINE_ADD * IFNULL(CONFIG.FILE_WEIGHT,1) * 0.9 + C.LINE_DEL * IFNULL(CONFIG.FILE_WEIGHT,1) * 0.1) AS TASK_WP
 FROM DW_GITLAB_CODE C
   LEFT JOIN 
   ( 
      SELECT 'java' AS FILE_TYPE,5 AS FILE_WEIGHT FROM DUAL
      UNION
      SELECT 'python' AS FILE_TYPE,5 AS FILE_WEIGHT FROM DUAL
      UNION
      SELECT 'md' AS FILE_TYPE,5 AS FILE_WEIGHT FROM DUAL
      UNION
      SELECT 'jsp' AS FILE_TYPE,3 AS FILE_WEIGHT FROM DUAL
      UNION
      SELECT 'js' AS FILE_TYPE,3 AS FILE_WEIGHT FROM DUAL
      UNION
      SELECT 'css' AS FILE_TYPE,3 AS FILE_WEIGHT FROM DUAL
   ) CONFIG
   ON C.FILE_TYPE = CONFIG.FILE_TYPE
   GROUP BY C.RELATED_PR_CUID
) T
WHERE PR.ISDELETED = 0 
 AND PR.ID = T.RELATED_PR_CUID
 AND PR.STATE = 'merged'
 AND PR.COMMITTER = U.ACCOUNT
 AND U.DELETED = '0'
 AND PR.TASK_ID = TASK.ID
 AND PR.pr_time > '%s'
 ORDER BY U.ACCOUNT,PR.PR_TIME `,
    '人力报工': `select a.work_date,b.realname as username,a.task_id, a.work_time ,a.task_type 
    from dw_worklog_sync a, zt_user b 
    where a.work_date >'%s' and (a.task_type=1 or a.task_type=2 or a.task_type=3 ) and b.account=a.account `,
    '人员': 'select * from  bi_report_amb_accountbymonth',
    '报工报表': `select a.work_date as 报工时间,
    b.username as 报工人,
    a.TASK_ID AS 任务编号,
    a.work_time as 报工时长,
    '任务' AS 报工类型
     from dw_worklog a, dw_user b where a.task_type=2 and a.work_date >'%s' and b.id=a.user_id and b.dep_id = 'zh'
    union all
    select a.work_date as 报工时间,
    b.username as 报工人,
    a.TASK_ID AS 任务编号,
    a.work_time as 报工时长,
    '需求' AS 报工类型
     from dw_worklog a, dw_user b where a.task_type=1 and a.work_date >'%s' and b.id=a.user_id and b.dep_id = 'zh'
    union all
    select a.work_date as 报工时间,
    b.username as 报工人,
    a.TASK_ID AS 任务编号,
    a.work_time as 报工时长,
    'BUG' AS 报工类型
     from dw_worklog a, dw_user b where a.task_type=3 and a.work_date >'%s' and b.id=a.user_id and b.dep_id = 'zh' `,
  },
  errorpr: [
    { id: 'DW_GITLAB_PR-74_3280_45_9195', product: '资源平台', province: '公共' },
    { id: 'DW_GITLAB_PR-74_3281_46_982', product: '资源平台', province: '公共' },
    { id: 'DW_GITLAB_PR-62_3469_79_2672', product: '资源平台', province: '公共' },
    { id: 'DW_GITLAB_PR-305_944_3_8133', product: '网络割接', province: '陕西' },
    { id: 'DW_GITLAB_PR-315_4962_139_7258', product: '家客资源', province: '陕西' },
    { id: 'DW_GITLAB_PR-324_768_3_8405', product: '资源平台', province: '公共' },
    { id: 'DW_GITLAB_PR-222_3099_126_9501', product: '集客开通', province: '福建' },
    { id: 'DW_GITLAB_PR-223_4431_145_8693', product: '集客开通', province: '公共' },
    { id: 'DW_GITLAB_PR-83_5391_5_340', product: '资源平台', province: '河南' },
    { id: 'DW_GITLAB_PR-304_893_1_1721', product: '网络割接', province: '公共' },
    { id: 'DW_GITLAB_PR-477_5043_2_7505', product: '广东本地化产品', province: '广东' },
    { id: 'DW_GITLAB_PR-298_394_1_2679', product: '网络割接', province: '公共' },
    { id: 'DW_GITLAB_PR-305_894_1_259', product: '网络割接', province: '公共' },
    { id: 'DW_GITLAB_PR-303_895_4_9997', product: '网络割接', province: '公共' },
    { id: 'DW_GITLAB_PR-299_621_1_9888', product: '网络割接', province: '公共' },
    { id: 'DW_GITLAB_PR-384_2935_35_6156', product: '传输调度', province: '公共' },
    { id: 'DW_GITLAB_PR-315_401_1_5379', product: '家客资源', province: '西藏' },
    { id: 'DW_GITLAB_PR-314_402_1_7438', product: '家客资源', province: '西藏' },
    { id: 'DW_GITLAB_PR-314_403_2_450', product: '家客资源', province: '西藏' },
    { id: 'DW_GITLAB_PR-315_4966_140_9689', product: '家客资源', province: '陕西' },
    { id: 'DW_GITLAB_PR-75_5492_107_6475', product: '资源平台', province: '广东' },
    { id: 'DW_GITLAB_PR-56_413_1_3357', product: '家客资源', province: '公共' },
    { id: 'DW_GITLAB_PR-86_421_1_9480', product: '资源平台', province: '公共' },
    { id: 'DW_GITLAB_PR-320_456_2_1422', product: '广东本地化产品', province: '广东' },
    { id: 'DW_GITLAB_PR-320_620_3_9690', product: '广东本地化产品', province: '广东' },
    { id: 'DW_GITLAB_PR-320_702_4_3109', product: '广东本地化产品', province: '广东' },
    { id: 'DW_GITLAB_PR-320_904_5_8627', product: '广东本地化产品', province: '广东' },
    { id: 'DW_GITLAB_PR-320_1362_7_9119', product: '广东本地化产品', province: '广东' },
    { id: 'DW_GITLAB_PR-382_488_1_2970', product: '集客开通', province: '内蒙' },
    { id: 'DW_GITLAB_PR-223_2270_76_8418', product: '集客开通', province: '内蒙' },
    { id: 'DW_GITLAB_PR-354_2566_35_3271', product: '传输调度', province: '上海' },
    { id: 'DW_GITLAB_PR-233_7174_29_8312', product: '集客开通', province: '陕西' },
    { id: 'DW_GITLAB_PR-269_6887_40_580', product: '管线资源', province: '广西' },
    { id: 'DW_GITLAB_PR-306_9374_76_8263', product: '网络割接', province: '广西' },
    { id: 'DW_GITLAB_PR-75_9560_169_2832', product: '资源平台', province: '公共' },
    { id: 'DW_GITLAB_PR-75_9562_170_8428', product: '资源平台', province: '公共' },
    { id: 'DW_GITLAB_PR-92_9705_23_1072', product: '传输调度', province: '公共' },
    { id: 'DW_GITLAB_PR-315_10225_265_307', product: '家客资源', province: '广西',task_id:'17766',type:'devel',story:'3847' },
    { id: 'DW_GITLAB_PR-314_10226_183_3695', product: '家客资源', province: '广西',task_id:'17766',type:'devel',story:'3847'},
    { id: 'DW_GITLAB_PR-314_12747_220_6108', product: '家客资源', province: '广西',task_id:'21906',type:'devel',story:'5591'},
    { id: 'DW_GITLAB_PR-382_13511_147_7995', product: '集客开通', province: '吉林',task_id:'24054',type:'design',story:'6521'},
    { id: 'DW_GITLAB_PR-222_12020_511_1210', product: '集客开通', province: '福建',task_id:'21179',type:'devel',story:'5540' },
    { id: 'DW_GITLAB_PR-382_14407_186_8450', product: '移动集团资源', province: '移动集团',task_id:'24402',type:'design',story:'6666' },
    { id: 'DW_GITLAB_PR-352_15397_39_1305', product: '家客资源', province: '北京',task_id:'24763',type:'devel',story:'6532' },
    { id: 'DW_GITLAB_PR-615_15072_51_6584', product: 'SDN', province: '公共',task_id:'24992',type:'devel',story:'6899' }]

};