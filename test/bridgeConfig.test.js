const data = require('./stub/data');
const logger = require('./stub/logger');
const zigbeeHerdsman = require('./stub/zigbeeHerdsman');
const MQTT = require('./stub/mqtt');
const path = require('path');
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
const settings = require('../lib/util/settings');
const Controller = require('../lib/controller');
const flushPromises = () => new Promise(setImmediate);


describe('Bridge config', () => {
    let controller;

    beforeAll(async () => {
        this.version = await require('../lib/util/utils').getZigbee2mqttVersion();
        controller = new Controller();
        await controller.start();
    })

    beforeEach(() => {
        data.writeDefaultConfiguration();
        settings._reRead();
        data.writeDefaultState();
    });

    it('Should publish bridge configuration on startup', async () => {
        expect(MQTT.publish).toHaveBeenCalledWith(
            'zigbee2mqtt/bridge/config',
          JSON.stringify({"version":this.version.version,"commit":this.version.commitHash,"coordinator":{"type":"z-Stack","meta":{"version":1}},"log_level":1,"permit_join":false}),
          { retain: true, qos: 0 },
          expect.any(Function)
        );
    });

    it('Should allow to set elapsed', async () => {
        MQTT.events.message('zigbee2mqtt/bridge/config/elapsed', 'true');
        await flushPromises();
        expect(settings.get().advanced.elapsed).toBe(true);
        MQTT.events.message('zigbee2mqtt/bridge/config/elapsed', 'false');
        await flushPromises();
        expect(settings.get().advanced.elapsed).toBe(false);
        MQTT.events.message('zigbee2mqtt/bridge/config/elapsed', 'wrong');
        await flushPromises();
        expect(settings.get().advanced.elapsed).toBe(false);
    });

    it('Should allow whitelist', async () => {
        const bulb_color = zigbeeHerdsman.devices.bulb_color;
        const bulb = zigbeeHerdsman.devices.bulb;
        expect(settings.get().whitelist).toStrictEqual([]);
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/whitelist', 'bulb_color');
        await flushPromises();
        expect(MQTT.publish).toHaveBeenCalledWith(
            'zigbee2mqtt/bridge/log',
          JSON.stringify({type: "device_whitelisted", "message": {friendly_name: "bulb_color"}}),
          { retain: false, qos: 0 },
          expect.any(Function)
        );

        MQTT.publish.mockClear()
        expect(settings.get().whitelist).toStrictEqual([bulb_color.ieeeAddr]);
        MQTT.events.message('zigbee2mqtt/bridge/config/whitelist', 'bulb');
        await flushPromises();
        expect(MQTT.publish).toHaveBeenCalledWith(
            'zigbee2mqtt/bridge/log',
          JSON.stringify({type: "device_whitelisted", "message": {friendly_name: "bulb"}}),
          { retain: false, qos: 0 },
          expect.any(Function)
        );

        MQTT.publish.mockClear()
        expect(settings.get().whitelist).toStrictEqual([bulb_color.ieeeAddr, bulb.ieeeAddr]);
        MQTT.events.message('zigbee2mqtt/bridge/config/whitelist', 'bulb');
        await flushPromises();
        expect(settings.get().whitelist).toStrictEqual([bulb_color.ieeeAddr, bulb.ieeeAddr]);
        expect(MQTT.publish).toHaveBeenCalledTimes(0);
    });

    it('Should allow changing device options', async () => {
        const bulb_color = zigbeeHerdsman.devices.bulb_color;
        expect(settings.getDevice('bulb_color')).toStrictEqual(
            {"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color", "friendly_name": "bulb_color", "retain": false}
        );
        MQTT.events.message('zigbee2mqtt/bridge/config/device_options', JSON.stringify({friendly_name: 'bulb_color', options: {retain: true}}));
        await flushPromises();
        expect(settings.getDevice('bulb_color')).toStrictEqual(
            {"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color", "friendly_name": "bulb_color", "retain": true}
        );
        MQTT.events.message('zigbee2mqtt/bridge/config/device_options', JSON.stringify({friendly_name: 'bulb_color', optionswrong: {retain: true}}));
        await flushPromises();
        expect(settings.getDevice('bulb_color')).toStrictEqual(
            {"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color", "friendly_name": "bulb_color", "retain": true}
        );
        MQTT.events.message('zigbee2mqtt/bridge/config/device_options', "{friendly_name: 'bulb_color'malformed: {retain: true}}");
        await flushPromises();
        expect(settings.getDevice('bulb_color')).toStrictEqual(
            {"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color", "friendly_name": "bulb_color", "retain": true}
        );
    });

    it('Should allow permit join', async () => {
        zigbeeHerdsman.permitJoin.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/permit_join', 'true');
        await flushPromises();
        expect(zigbeeHerdsman.permitJoin).toHaveBeenCalledTimes(1);
        expect(zigbeeHerdsman.permitJoin).toHaveBeenCalledWith(true);
        zigbeeHerdsman.permitJoin.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/permit_join', 'false');
        await flushPromises();
        expect(zigbeeHerdsman.permitJoin).toHaveBeenCalledTimes(1);
        expect(zigbeeHerdsman.permitJoin).toHaveBeenCalledWith(false);
    });

    it('Should allow to reset', async () => {
        zigbeeHerdsman.softReset.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/reset', '');
        await flushPromises();
        expect(zigbeeHerdsman.softReset).toHaveBeenCalledTimes(1);
        zigbeeHerdsman.softReset.mockImplementationOnce(() => {throw new Error('')});
        MQTT.events.message('zigbee2mqtt/bridge/config/reset', '');
        await flushPromises();
        expect(zigbeeHerdsman.softReset).toHaveBeenCalledTimes(2);
    });

    it('Should allow to set last_seen', async () => {
        MQTT.events.message('zigbee2mqtt/bridge/config/last_seen', 'ISO_8601');
        await flushPromises();
        expect(settings.get().advanced.last_seen).toBe('ISO_8601');
        MQTT.events.message('zigbee2mqtt/bridge/config/last_seen', 'disable');
        await flushPromises();
        expect(settings.get().advanced.last_seen).toBe('disable');
        MQTT.events.message('zigbee2mqtt/bridge/config/last_seen', 'notvalid');
        await flushPromises();
        expect(settings.get().advanced.last_seen).toBe('disable');
    });

    it('Should allow to set log_level', async () => {
        MQTT.events.message('zigbee2mqtt/bridge/config/log_level', 'debug');
        await flushPromises();
        expect(logger.transports.console.level).toBe('debug');
        expect(logger.transports.file.level).toBe('debug');
        MQTT.events.message('zigbee2mqtt/bridge/config/log_level', 'error');
        await flushPromises();
        expect(logger.transports.console.level).toBe('error');
        expect(logger.transports.file.level).toBe('error');
        MQTT.events.message('zigbee2mqtt/bridge/config/log_level', 'notvalid');
        await flushPromises();
        expect(logger.transports.console.level).toBe('error');
        expect(logger.transports.file.level).toBe('error');
    });

    it('Should allow to get devices', async () => {
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/devices/get', '');
        await flushPromises();
        expect(MQTT.publish.mock.calls[0][0]).toStrictEqual('zigbee2mqtt/bridge/config/devices');
        const payload = JSON.parse(MQTT.publish.mock.calls[0][1]);
        expect(payload.length).toStrictEqual(Object.values(zigbeeHerdsman.devices).length);
        expect(payload[0]).toStrictEqual({"ieeeAddr": "0x00124b00120144ae", "type": "Coordinator"});
        expect(payload[1]).toStrictEqual({"friendly_name": "bulb", "ieeeAddr": "0x000b57fffec6a5b2", "lastSeen": 1000, "manufacturerID": 4476, "model": "LED1545G12", "modelID": "TRADFRI bulb E27 WS opal 980lm", "networkAddress": 40369, "powerSource": "Mains (single phase)", "type": "Router"});
    });

    it('Should allow to get groups', async () => {
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/groups', '');
        await flushPromises();
        expect(MQTT.publish.mock.calls[0][0]).toStrictEqual('zigbee2mqtt/bridge/log');
        const payload = JSON.parse(MQTT.publish.mock.calls[0][1]);
        expect(payload).toStrictEqual({"message": [{"ID": 1, "friendly_name": "group_1", "retain": false, 'devices': [], optimistic: true}, {"ID": 2, "friendly_name": "group_2", "retain": false, "devices": [], optimistic: true}], "type": "groups"});
    });

    it('Should allow rename devices', async () => {
        const bulb_color2 = {"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color2", "friendly_name": "bulb_color2", "retain": false};
        MQTT.publish.mockClear();
        expect(settings.getDevice('bulb_color')).toStrictEqual({"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color", "friendly_name": "bulb_color", "retain": false});
        MQTT.events.message('zigbee2mqtt/bridge/config/rename', JSON.stringify({old: 'bulb_color', new: 'bulb_color2'}));
        await flushPromises();
        expect(settings.getDevice('bulb_color')).toStrictEqual(null);
        expect(settings.getDevice('bulb_color2')).toStrictEqual(bulb_color2);
        expect(MQTT.publish).toHaveBeenCalledWith(
            'zigbee2mqtt/bridge/log',
            JSON.stringify({type: 'device_renamed', message: {from: 'bulb_color', to: 'bulb_color2'}}),
            {qos: 0, retain: false},
            expect.any(Function)
        );

        MQTT.events.message('zigbee2mqtt/bridge/config/rename', JSON.stringify({old: 'bulb_color2', newmalformed: 'bulb_color3'}));
        await flushPromises();
        expect(settings.getDevice('bulb_color2')).toStrictEqual(bulb_color2);

        MQTT.events.message('zigbee2mqtt/bridge/config/rename', "{old: 'bulb_color2'newmalformed: 'bulb_color3'}");
        await flushPromises();
        expect(settings.getDevice('bulb_color2')).toStrictEqual(bulb_color2);

        MQTT.events.message('zigbee2mqtt/bridge/config/rename', JSON.stringify({old: 'bulb_color', new: 'bulb_color3'}));
        await flushPromises();
        expect(settings.getDevice('bulb_color2')).toStrictEqual(bulb_color2);
    });

    it('Should allow to add groups', async () => {
        zigbeeHerdsman.createGroup.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/add_group', 'new_group');
        await flushPromises();
        expect(settings.getGroup('new_group')).toStrictEqual({"ID": 3, "friendlyName": "new_group", "friendly_name": "new_group", devices: [], optimistic: true});
        expect(zigbeeHerdsman.createGroup).toHaveBeenCalledTimes(1);
        expect(zigbeeHerdsman.createGroup).toHaveBeenCalledWith(3)
    });

    it('Should allow to remove groups', async () => {
        settings.addGroup('to_be_removed')
        MQTT.events.message('zigbee2mqtt/bridge/config/remove_group', 'to_be_removed');
        await flushPromises();
        expect(settings.getGroup('to_be_removed')).toStrictEqual(null);
    });

    it('Shouldnt do anything on unsupported topic', async () => {
        await flushPromises();
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/not_supported', 'to_be_removed');
        await flushPromises();
        expect(MQTT.publish).toHaveBeenCalledTimes(0);
    });

    it('Should allow to remove device', async () => {
        controller.state.state = {'0x000b57fffec6a5b3': {brightness: 100}};
        const device = zigbeeHerdsman.devices.bulb_color;
        device.removeFromNetwork.mockClear();
        await flushPromises();
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/remove', 'bulb_color');
        await flushPromises();
        expect(device.removeFromNetwork).toHaveBeenCalledTimes(1);
        expect(controller.state[device.ieeeAddr]).toBeUndefined();
        expect(settings.getDevice('bulb_color')).toBeNull();
        expect(MQTT.publish).toHaveBeenCalledTimes(1);
        expect(MQTT.publish).toHaveBeenCalledWith(
            'zigbee2mqtt/bridge/log',
            JSON.stringify({type: 'device_removed', message: 'bulb_color'}),
            {qos: 0, retain: false},
            expect.any(Function)
        );
        expect(controller.state.state).toStrictEqual({})
    });

    it('Should allow to ban device', async () => {
        // TODO: Ban doesn't ban at the moment
        const device = zigbeeHerdsman.devices.bulb_color;
        device.removeFromNetwork.mockClear();
        await flushPromises();
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/ban', 'bulb_color');
        await flushPromises();
        expect(device.removeFromNetwork).toHaveBeenCalledTimes(1);
        expect(controller.state[device.ieeeAddr]).toBeUndefined();
        expect(settings.getDevice('bulb_color')).toBeNull();
        expect(MQTT.publish).toHaveBeenCalledTimes(1);
        expect(MQTT.publish).toHaveBeenCalledWith(
            'zigbee2mqtt/bridge/log',
            JSON.stringify({type: 'device_banned', message: 'bulb_color'}),
            {qos: 0, retain: false},
            expect.any(Function)
        );
    });

    it('Should handle when remove fails', async () => {
        const device = zigbeeHerdsman.devices.bulb_color;
        device.removeFromNetwork.mockClear();
        device.removeFromNetwork.mockImplementationOnce(() => {throw new Error('')})
        await flushPromises();
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/remove', 'bulb_color');
        await flushPromises();
        expect(device.removeFromNetwork).toHaveBeenCalledTimes(1);
        expect(settings.getDevice('bulb_color')).toStrictEqual({"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color", "friendly_name": "bulb_color", "retain": false})
        expect(MQTT.publish).toHaveBeenCalledTimes(0);
    });

    it('Should handle when ban fails', async () => {
        const device = zigbeeHerdsman.devices.bulb_color;
        device.removeFromNetwork.mockClear();
        device.removeFromNetwork.mockImplementationOnce(() => {throw new Error('')})
        await flushPromises();
        MQTT.publish.mockClear();
        MQTT.events.message('zigbee2mqtt/bridge/config/ban', 'bulb_color');
        await flushPromises();
        expect(device.removeFromNetwork).toHaveBeenCalledTimes(1);
        expect(settings.getDevice('bulb_color')).toStrictEqual({"ID": "0x000b57fffec6a5b3", "friendlyName": "bulb_color", "friendly_name": "bulb_color", "retain": false})
        expect(MQTT.publish).toHaveBeenCalledTimes(0);
    });
});
