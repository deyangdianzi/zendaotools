'use strict';
/**
 * model
 */
export default class extends think.model.base {

    getGroupList() {
        return this.group('month,name').select();
    }

}