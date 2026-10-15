import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parkingStatus as status} from '../dist/parking.js';
test('Brighton winter rules respect enforcement times and Christmas exception',()=>{
 assert.equal(status('2026-12-04','09:00'),'required');
 assert.equal(status('2026-12-04','11:59'),'required');
 assert.equal(status('2026-12-04','12:00'),'not_required');
 assert.equal(status('2026-12-04','06:59'),'closed');
 assert.equal(status('2026-12-04','07:00'),'required');
 assert.equal(status('2026-12-25','09:00'),'not_required');
 assert.equal(status('2026-12-21','09:00'),'required');
 assert.equal(status('2027-01-18','09:00'),'required');
 assert.equal(status('2027-02-15','09:00'),'required');
 assert.equal(status('2027-01-11','09:00'),'not_required');
});
test('uncertain or unverified dates never claim no reservation is needed',()=>{
 for(const day of ['2027-01-19','2027-02-16','2027-02-30'])assert.equal(status(day),'unconfirmed');
 for(const day of ['2026-10-15','2026-12-03','2027-04-19','2027-12-04'])assert.equal(status(day),'outside_window');
 assert.equal(status('2026-12-04','25:00'),'unconfirmed');
});
