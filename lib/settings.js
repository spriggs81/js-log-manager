// outside dependencies
import cron from 'node-cron'

// local dependencies
import path from "node:path"
import os from "node:os"

// local functions
import { isString, isNumber, isFilenameSafe, getDate } from "./functions.js"

export const _config = {
    todayDate: null,
    nextDateRotation: null,
    baseDir: path.join(process.cwd(), '.logs'),
    maxBufferSize: 256, //kb
    deletionTime: '05 0 * * *',
    filePattern: /^(.+?)_(\d{4}-\d{2}-\d{2})(_\d{3})?\.log$/,
    deletionBatchSize: 5

}

const appSetting = {
    cleanupTime: startTime => {
        if(!isString(startTime)) throw new Error(`The time provided for the clean up app isn't a string`)

        if(!cron.validate(startTime)){
            throw new Error(`The time provided isn't in the correct format.  If you need help try: https://crontab.guru/`)
        } else {
            _config.deletionTime = startTime
            return _config
        }
    },

    setDir: dir => {
        if(!isString(dir)) throw new Error(`JS-Log-Manager support strings for the directory update`)

        if(!isFilenameSafe(dir)) {
            const prohibited = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '.'];
            throw new Error(`Directory name is unsafe or contains prohibited characters. The following are NOT allowed: ${prohibited.join(' ')}`);
        } else {
            _config.baseDir = path.join(process.cwd(), dir)
            return _config
        }
    },

    setBufferSize: (num) => {
        if(!isNumber(num) && num <= 0) throw new Error(`The Buffer Size(KB) must be a number that is greater than zero!`)

        _config.maxBufferSize = num
        return _config
    },

    setDeletionBatchSize: (num) => {
         if(!isNumber(num) && num <= 0) throw new Error(`The Deletion Batch Size must be a number that is greater than zero!`)

        _config.deletionBatchSize = num
        return _config
    }
}

export const bufferAutoTune = () => {

        const   budget = 64,
                balanced = 128,
                extreme = 256

    const model = os.cpus()[0].model

    // 1. Check for high-end "Extreme" chips
    const isExtreme = /[iR][79]-/.test(model) || /Max|Ultra|Threadripper|EPYC/i.test(model);
    
    // 2. Check for mid-range "Balanced" chips
    const isBalanced = /[iR]5-/.test(model) || /Apple M[1-3](?! (Max|Ultra))/.test(model);

    if(isExtreme) {
        _config.maxBufferSize = extreme
        console.log(`JS-Log-Manager has set your write buffer to 256kb (Extreme Mode)!`)
    } else if(isBalanced) {
        _config.maxBufferSize = balanced
        console.log(`JS-Log-Manager has set your write buffer to 128kb (Balance Mode)!`)
    } else {
        _config.maxBufferSize = budget
        console.log(`JS-Log-Manager has set your write buffer to 64kb (Budget Mode)!`)
    }
    return _config;
}

export const configuration = obj => {
    for(const key in obj) {
        if(key in appSetting) {
            appSetting[key](obj[key])
        }
    }
}

export const setDate = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setHours(24, 0, 0, 0)
    _config.todayDate = getDate()
    _config.nextDateRotation = tomorrow.getTime()
    return _config
}