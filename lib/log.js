/*
*  File that handles everything related to the logging part of our app
*
*/
// local denpendencies
import os from 'node:os'
import path from 'node:path'
import { createWriteStream } from 'node:fs'

// local settings
import { _config, setDate } from './settings.js'

// local functions
import { isString, isNumber, colors, verifyAndFormatLog, formatTime, createDir, indexFile, checkTheFileSize, getDate, getTime} from './functions.js'

export default class Logs {
    constructor({filename, level = null, maxSize = 250, txtColor, bgColor, benchmark = false, toFile = true, toTerminal = true, terminalRaw = false}){
        if(!isString(filename)) throw new Error(`JS-Log_Manager supports 'Strings' for the filename only!`)
        if(level !== null && !isString(level) && !isNumber(level)) throw new Error(`JS-Log_Manager supports 'Strings' or 'Numbers (zero or greater)' for the level only!`)
        if(!isNumber(maxSize) && maxSize > 0) throw new Error(`JS-Log_Manager supports 'Numbers (greater than zero)' for the maxSize only!`)
        
        //Object.assign(this, {filename, level, benchmark})
        Object.assign(this, { filename, level, benchmark, toFile, toTerminal, terminalRaw})
        
        this.txtColor = isString(txtColor) && colors.txt.hasOwnProperty(txtColor) ? colors.txt[txtColor] : null
        this.bgColor = isString(bgColor) && colors.bg.hasOwnProperty(bgColor) ? colors.bg[bgColor] : null

        // variables needed to handle the processing of the terminal logs
        this.terminalQueue = []
        this.terminalStream = null

        // variables needed to handle the processing of the raw terminal logs
        this.rawTerminalQueue = []
        this.rawTerminalStream = null

        // variables needed to handle the processing of the file logs
        this.doesDirecttoryExist = false
        this.writeStream = null
        this.streamFilename = null
        this.isDraining = false
        this.maxBufferSizeByKB = 1024 * _config.maxBufferSize
        this.fileQueue = []
        this.maxFileSizeByMB = 1024 * 1024 * maxSize
        this.cachedFileSize = 0
        this.isIndexing = false
        this.checkedFileSize = false
        this.isDateUpdating = false

        // variables needed to handle flush (benefit for benchmarking)
        this.flushPromise = null
        this.resolveFlush = null

        // holding metadata
        this.hostname = os.hostname()
        this.pid = process.pid
        
        // the start up function that handles all the processes needed when the app starts
        this.initStart()
    }

    // creates a stream to handle processing the terminal's queue
    startTerminalStream = (raw = false) => {
        // check for the type of system being used to run our app
        const system = os.platform()
        
        // create a stream based on system and settings
        const streamPath = this.benchmark && system === 'win32' ? 'NUL'
                        : this.benchmark && (system === 'darwin' || system === 'linux') ? '/dev/null'
                        : process.stdout

        const settings = streamPath === '/dev/null' || streamPath === 'NUL' ? {flags: 'w'} : {fd: 1}
        
        if(!raw){
            this.terminalStream = createWriteStream(streamPath, settings)
            this.processTerminalQue()
        } else {
            this.rawTerminalStream = createWriteStream(streamPath, settings)
            this.processRawTerminalQue()
        }
    }

    // function that prints to the terminal with ANSI colors if provided in settings
    terminal = (userLog, manualTime = null) => {
        this.checkDate()
        if(this.isDateUpdating) {
            setImmediate(() => this.terminal(userLog))
            return
        }

        const time = manualTime ? manualTime : getTime()

        const level = this.level ? (typeof(this.level) === 'string' ? `"level":"${this.level}",` : `"level":${this.level},`) : '';

        const metadata =    !this.benchmark 
                            ? `"logTime":"${_config.todayDate}T${time}","hostname":"${this.hostname}","pid":${this.pid},`
                            : ''

        // verify the log and return a string version of the log for processing
        const verifiedLog = verifyAndFormatLog(userLog)

        if(this.txtColor) colorCode += '\x1b[' + this.txtColor + 'm'
        if(this.bgColor) colorCode += '\x1b[' + this.bgColor + 'm'

        const fullLog = colorCode + '{' + level + metadata + verifiedLog + '}' + colors.reset

        this.terminalQueue.push(fullLog + '\n')
        this.processTerminalQue()
    }

    // function to process the terminal queue
    processTerminalQue = () => {
        // make sure there's something to do if not do nothing
        if(this.terminalQueue.length === 0) return
        
        // check if the terminal stream has started if not start it
        if(!this.terminalStream){
            this.startTerminalStream()
            return
        }

        // process the queue if there's logs that need processing
        while(this.terminalQueue.length > 0){
            this.terminalStream.write(this.terminalQueue.shift())
        }
    }

    // function that prints to the terminal without any special needs or readable data (mainly used for benchmarking)
    terminal_raw = (userLog, manualTime = null) => {
        const level = this.level ? (typeof(this.level) === 'string' ? `"level":"${this.level}",` : `"level":${this.level},`) : '';
        const time = manualTime ? Date.now(_config.todayDate + manualTime) : Date.now()
        const metadata =    !this.benchmark 
                            ? `"logTime":"${time}","hostname":"${this.hostname}","pid":${this.pid},`
                            : ''

        // verify the log and return a string version of the log for processing
        const verifiedLog = verifyAndFormatLog(userLog)

        this.rawTerminalQueue.push('{'+level + metadata+ verifiedLog +'}' + '\n')
        this.processRawTerminalQue()
    }

    // function to process the raw terminal queue
    processRawTerminalQue = () => {
        // make sure there's something to do if not do nothing
        if(this.rawTerminalQueue.length === 0) return
        
        // check if the terminal stream has started if not start it
       if(!this.rawTerminalStream){
           this.startTerminalStream(true)
           return
       }

        // process the queue if there's logs that need processing
        while(this.rawTerminalQueue.length > 0){
            this.rawTerminalStream.write(this.rawTerminalQueue.shift())
        }
    }

    // creates the directory for the file log folder
    _createDir = async () => {
        // if directory exist exit function
        if(this.doesDirecttoryExist) return

        // create directory if doesn't exist
        await createDir()
    
        // update flag
        this.doesDirecttoryExist = true
    }

    // creates a writable stream and handles draining
    startWriteStream = () => {
        // if a write stream exist do nothing
        if(this.writeStream) return

        // create the stream's filename and path
        this.streamFilename = this.filename + '_' + _config.todayDate + '.log'
        const filePath = path.join(_config.baseDir, this.streamFilename)

        // create a write stream and set the buffer
        this.writeStream = createWriteStream(filePath, {
            highWaterMark: this.maxBufferSizeByKB,
            flags: 'a'
        })

        // let's start processing the file que
        setImmediate(() => this.processFileQue())

        // handle draining of the buffer
        this.writeStream.on('drain', () => {
            this.isDraining = false
            // back to processing the file que
            setImmediate(() => this.processFileQue())
        })
    }

    // function to end the write stream 
    endWriteStream = (callback = () => {}) => {
        // if no write stream do nothing
        if(!this.writeStream) return

        // end stream, update writestream, and handle callback
        this.writeStream.end(() => {
            this.writeStream = null
            callback()
        })
    }

    file = (userLog, manualTime = null) => {
        this.checkDate()
        if(this.isDateUpdating) {
            setImmediate(() => this.file(userLog))
            return
        }
        const time = manualTime ? manualTime : getTime()
        const level = this.level ? (typeof(this.level) === 'string' ? `"level":"${this.level}",` : `"level":${this.level},`) : '';

        const metadata =    !this.benchmark 
                            ? `"logTime":"${_config.todayDate}T${time}","hostname":"${this.hostname}","pid":${this.pid},`
                            : ''

        // verify the log and return a string version of the log for processing
        const verifiedLog = verifyAndFormatLog(userLog)
        
        this.fileQueue.push('{'+level + metadata+ verifiedLog +'}' + '\n')
        this.processFileQue()
    }

    processFileQue = () => {

        if(this.fileQueue.length === 0) return

        // Anything that could cause a problem don't process anything
        if(this.isDraining || this.isIndexing || !this.doesDirecttoryExist) return

        // if there's no write stream create one
        if(!this.writeStream) {
            this.startWriteStream()
            return
        }

        // let's create a blank/empty string for writing
        let str = ''

        // lets create a target size for our buffer
        const targetSize = this.maxBufferSizeByKB * .80

        while(!this.isDraining && !this.isIndexing && this.fileQueue.length > 0) {
            // lets create the string we will use to write to the file
            const grab = this.fileQueue.length > 5000 ? 5000 : this.fileQueue.length
            const chunks = this.fileQueue.splice(0, grab)
            
            // add our chunks to the string
            str += chunks.join('')
            
            // Once our string is big enough write to the file
            if(str.length >= targetSize 
                || (this.cachedFileSize + str.length) >= this.maxFileSizeByMB
                || (this.fileQueue.length === 0 && str.length > 0)) {
                    // write to the file and handle draining
                    const noBackPressure = this.writeStream.write(str)
                    // console.log('numbers: ',str.length)
                    
                // add the written string length to the cache
                this.cachedFileSize += str.length

                // if there's back pressure (draining needed) then update the flag
                if(noBackPressure === false) {
                    this.isDraining = true
                }
                // index the logs if the cache is greater than or equal to the max file size
                if(this.cachedFileSize >= this.maxFileSizeByMB) {
                    this._indexFile(this.streamFilename)
                }

                // reset the string after writing to the file
                str = ''
            }
        }
        // make sure that we continuing processing the file que if we exit the while loop if needed
        if(this.fileQueue.length > 0 && !this.isDraining && !this.isIndexing) {
            this.processFileQue()
        } else if(this.fileQueue.length === 0 && this.resolveFlush) {
            // call flush to trigger cleanup
            this.flush()
        }
    }

    // The new Unified Logging Function
    logg(data) {
        const timestamp = getTime(); // Capture ONCE for perfect synchronization

        if (this.toFile) {
            this.file(data, timestamp);
        }

        if (this.toTerminal) {
            if (this.terminalRaw) {
                this.terminal_raw(data, timestamp);
            } else {
                this.terminal(data, timestamp);
            }
        }
    }

    // index the file and add the '000' index to the filename
    _indexFile = (filename) => {
        // if indexing already do nothing
        if(this.isIndexing) return

        // update flag
        this.isIndexing = true

        // update the stream file name to null
        this.streamFilename = null

        // end write stream and handle indexing
        this.endWriteStream(async () => {
            // make sure that the stream is ended
            if(this.writeStream === null) {
                try {
                    await indexFile(filename)
                } catch (error) {
                    console.error(`[Error Handling Indexing]: ${error.message}`)
                } finally {
                    this.isIndexing = false
                    this.cachedFileSize = 0
                    if(this.isDraining) {
                        this.isDraining = false
                    }
                    setImmediate(() => this.startWriteStream())
                }
            }
        })
    }

    // checks the size of the file if it exist and updates the cache
    _checkTheFileSize = async () => {
        // if checked do nothing
        if(this.checkedFileSize) return

        // create the filename to check
        const filename = this.filename + '_' + _config.todayDate + '.log'

        // get the size of the file if available
        const size = await checkTheFileSize(filename)

        // update cache size if size is greater than zero
        if(size > 0) this.cachedFileSize = size

        //update the flag
        this.checkedFileSize = true
    }

    // function that starts all the upfront processes
    initStart = async () => {
        setDate()
        // create dir at startup
        await this._createDir()

        // check the file size at startup
        await this._checkTheFileSize()

        // start processing the ques
        this.processTerminalQue()
        this.processRawTerminalQue()
        this.processFileQue()

    }

    checkDate = () => {
        if(Date.now() >= _config.nextDateRotation) {
            this.isDateUpdating = true
            setDate()
            this.endWriteStream(() => {
                this.isDateUpdating = false
                if(this.writeStream === null) {
                    // start processing the ques
                    this.processTerminalQue()
                    this.processRawTerminalQue()
                    this.processFileQue()
                }
            })
        }
    }

    // flush is used to help benchmark show time after writeStream is finshed writing
    flush = () => {
        // if no promise, create one
        if(!this.flushPromise) {
            this.flushPromise = new Promise(resolve => {
                this.resolveFlush = resolve
            })
        }

        if(this.isIndexing) {
            this.flushPromise
        }

        if(this.fileQueue.length === 0 && this.writeStream) {
            // end write stream immediately
            this.endWriteStream(this.resolveFlush)
            // reset resolver
            this.resolveFlush = null
        } else if(this.fileQueue.length === 0 && !this.writeStream) {
            // que is empty and writeStream is null resolve
            this.resolveFlush()
            // reset promise
            this.flushPromise = null
        }
        return this.flushPromise
    }
}

const error = new Logs({filename: 'error'})

// error.dateinfo()
// error.time()