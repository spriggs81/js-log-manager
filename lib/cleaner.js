import {readdir, unlink} from 'node:fs/promises'
import path from 'node:path'
import cron from 'node-cron'

// Import necessary utilities for resilience and parsing
import { daysSinceToday, createDir, isObject, isNumber } from './functions.js'
import { _config } from './settings.js'

let isCronAlreadyRunning = false

const assignObject = (obj) => {
    const message = []
    const newObj = {}
    for(const key in obj){
        const lowKey = key.toLowerCase()
        const value = obj[key]
        if(isNumber(value)){
            newObj[lowKey] = obj[key]
        } else {
            message.push(key)
        }
    }
    if(message.length > 0) throw new Error(`The Following Object Keys are not numbers and need to be corrected: ${message}`)
    return newObj;
}

const start = (options) => {
    if(isCronAlreadyRunning){
        console.error('These a Cron Job already running for Cleaning Up Logs!  Another Cron Job will not be started!')
        return
    } else if(!isCronAlreadyRunning) {
        isCronAlreadyRunning = true
    }
    
    console.log('File Log Clean-Up Cron Job Started!')

    cron.schedule(_config.deletionTime, async () =>{
        if(options && !isNumber(options) && !isObject(options)) throw new Error('JS-Log-Manager Supports objects or numbers for deletion options')
        
        const fileBreakDown = isObject(options) ? assignObject(options) : null
        
        let defaultTime = null
        if(isNumber(options) && options > 1) {
            defaultTime = options
        } else if (isObject(options)) {
            if(options.default) defaultTime = options.default
        } else {
            defaultTime = 30
        }

        try {
            await createDir() 
            const files = await readdir(_config.baseDir)

            //  if nothing is there exit functions
            if(files.length === 0) return
            
            // BATCH LOGIC START
            const deletionQueue = []
            const BATCH_SIZE = _config.deletionBatchSize

            for (const name of files) {
                const match = name.match(_config.filePattern)
                if(!match) continue

                const logName = match[1].toLowerCase()
                const dateString = match[2]

                const maxAgeDay = (fileBreakDown && fileBreakDown[logName]) ? fileBreakDown[logName] : defaultTime
                if(!maxAgeDay) continue
                
                const agedFile = daysSinceToday(dateString)

                if(agedFile > maxAgeDay){
                    deletionQueue.push(path.join(_config.baseDir, name))

                    // Once we hit the batch limit, delete the group
                    if(deletionQueue.length >= BATCH_SIZE) {
                        await Promise.all(deletionQueue.map(filePath => unlink(filePath)))
                        deletionQueue.length = 0 // Clear the array
                    }
                }
            }

            // Delete any remaining files (4 or fewer)
            if(deletionQueue.length > 0) {
                await Promise.all(deletionQueue.map(filePath => unlink(filePath)))
            }
            // BATCH LOGIC END

        } catch (error) {
            if (error.code === 'ENOENT') return 
            console.error(`[Error Deleting Log File]: ${error.message}`)
        }
    })
}

export default start