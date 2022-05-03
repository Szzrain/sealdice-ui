import { backend } from './backend'

export interface AdapterQQ {
  connectUrl: string;
  useInPackGoCqhttp: boolean;
  inPackGoCqHttpLoginSuccess: boolean;
  inPackGoCqHttpRunning: boolean;
  inPackGoCqHttpQrcodeReady: boolean;
  inPackGoCqHttpNeedQrCode: boolean;
  inPackGoCqHttpLastRestricted: number;
  inPackGoCqHttpLoginDeviceLockUrl: string;
}

interface TalkLogItem {
  name?: string
  content: string
  isSeal?: boolean
}

export interface DiceConnection {
  id: string;
  state: number;
  platform: string;
  workDir: string;
  enable: boolean;
  protocolType: string;
  nickname: string;
  userId: number;
  groupNum: number;
  cmdExecutedNum: number;
  cmdExecutedLastTime: number;
  onlineTotalTime: number;

  adapter: AdapterQQ;
}

const urlPrefix = 'sd-api'

interface DiceServer {
  config: any
  customTextsHelpInfo: { [k: string]: {
    [k: string]: {
      filename: string[],
      origin: (string[])[],
      vars: string[],
      modified: boolean
    }
  }}
  customTexts: { [k: string]: { [k: string]: (string[])[] } }
  logs: { level: string, ts: number, caller: string, msg: string }[]
  conns: DiceConnection[]
  baseInfo: DiceBaseInfo
  qrcodes: { [key: string]: string }
};

interface DiceBaseInfo {
  version: string
  memoryAlloc: number
  memoryUsedSys: number
  uptime: number
}

import { defineStore } from 'pinia'

export const useStore = defineStore('main', {
  state: () => {
    return {
      salt: '',
      token: '',
      index: 0,
      canAccess: false,
      diceServers: [] as DiceServer[],

      talkLogs: [
        {
          content: '海豹，正在等待。',
          isSeal: true
        },
        {
          content: '（请注意，当前会话记录在刷新页面后会消失）',
          isSeal: true
        },
      ] as TalkLogItem[]
    }
  },
  getters: {
    curDice(): DiceServer {
      if (this.diceServers.length === 0) {
        this.diceServers.push({
          baseInfo: { version: '0.0', memoryUsedSys: 0, memoryAlloc: 0, uptime: 0 },
          customTexts: {},
          customTextsHelpInfo: {},
          logs: [],
          conns: [],
          qrcodes: {},
          config: {}
        })
      }

      return this.diceServers[this.index]
    }

  },
  actions: {
    async customTextSave(category: string) {
      await backend.post(urlPrefix+'/configs/customText/save', { data: this.curDice.customTexts[category], category })
    },

    async getBaseInfo() {
      const info = await backend.get(urlPrefix+'/baseInfo')
      this.curDice.baseInfo = info as any;
      return info
    },

    async getCustomText() {
      const info = await backend.get(urlPrefix+'/configs/customText')
      const data = info as any;
      this.curDice.customTexts = data.texts;
      this.curDice.customTextsHelpInfo = data.helpInfo;
      return info
    },

    async getImConnections() {
      const info = await backend.get(urlPrefix+'/im_connections/list')
      this.diceServers[this.index].conns = info as any;
      return info
    },

    async gocqhttpReloginImConnection(i: DiceConnection) {
      const info = await backend.post(urlPrefix+'/im_connections/gocqhttpRelogin', { id: i.id })
      return info as any as DiceConnection
    },

    async addImConnection(form: { account: string, password: string, protocol: number }) {
      const { account, password, protocol } = form
      const info = await backend.post(urlPrefix+'/im_connections/add', { account, password, protocol })
      return info as any as DiceConnection
    },

    async removeImConnection(i: DiceConnection) {
      const info = await backend.post(urlPrefix+'/im_connections/del', { id: i.id })
      return info as any as DiceConnection
    },

    async getImConnectionsQrCode(i: DiceConnection) {
      const info = await backend.post(urlPrefix+'/im_connections/qrcode', { id: i.id })
      return info as any as { img: string }
    },

    async getImConnectionsSetEnable(i: DiceConnection, enable: boolean) {
      const info = await backend.post(urlPrefix+'/im_connections/set_enable', { id: i.id, enable })
      return info as any as DiceConnection
    },

    async logFetchAndClear() {
      const info = await backend.get(urlPrefix+'/log/fetchAndClear')
      this.curDice.logs = info as any;
    },

    async diceConfigGet() {
      const info = await backend.get(urlPrefix+'/dice/config/get')
      this.curDice.config = info as any;
    },

    async diceConfigSet(data: any) {
      await backend.post(urlPrefix+'/dice/config/set', data)
      await this.diceConfigGet()
    },

    async diceExec(text: string) {
      const info = await backend.post(urlPrefix+'/dice/exec', { message: text })
      return info as any
    },

    async getCustomReply() {
      const info = await backend.get(urlPrefix+'/configs/custom_reply')
      return info
    },

    async backupList() {
      const info = await backend.get(urlPrefix+'/backup/list')
      return info as any
    },

    async backupConfigGet() {
      const info = await backend.get(urlPrefix+'/backup/config_get')
      return info as any
    },

    async backupConfigSave(data: any) {
      const info = await backend.post(urlPrefix+'/backup/config_set', data)
      return info as any
    },

    async backupDoSimple() {
      const info = await backend.post(urlPrefix+'/backup/do_backup')
      return info as any
    },

    async groupList() {
      const info = await backend.get(urlPrefix+'/group/list')
      return info as any
    },

    async setCustomReply(data: any) {
      const info = await backend.post(urlPrefix+'/configs/custom_reply/save', data)
      return info
    },

    async signIn(password: string) {
      try {
        const ret = await backend.post(urlPrefix+'/signin', { password })
        const token = (ret as any).token
        this.token = token
        backend.defaults.headers.common['token'] = token
        localStorage.setItem('t', token)
        this.canAccess = true
      } catch {
        this.canAccess = false
      }
    },

    async checkSecurity(): Promise<boolean> {
      return (await backend.get(urlPrefix+'/checkSecurity') as any).isOk
    },

    async trySignIn(): Promise<boolean> {
      this.salt = (await backend.get(urlPrefix+'/signin/salt') as any).salt
      let token = localStorage.getItem('t')
      try {
        await backend.get(urlPrefix+'/hello', {
          headers: {token: token as string}
        })
        this.token = token as string
        backend.defaults.headers.common['token'] = this.token
        this.canAccess = true
      } catch (e) {
        this.canAccess = false
        // 试图做一次登录，以获取token
        await this.signIn('defaultSignin')
      }
      return this.token != ''
    }
  }
})
