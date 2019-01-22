/* These variables are relatively constant. If using a
 * special ESC, they may require some attention. These 
 * signify the minimum and maximum output period (?I
 * think?) to output over PWM to the ESC. 1000 microseconds
 * (us) is stationary. 2300us is about max speed.
 */
var OUTPUT_PERIOD_US_MIN = 1000;
var OUTPUT_PERIOD_US_MAX = 2300;

/* When a log file is output, this will be the prefix of
 * the name of the log file.
 */
var filePrefix = "CustTest";

/* The target thrust to maintain in kgf.
 */
var THRUST_TARGET_KGF = 2.2;

/* The percent error that is acceptable in thrust. For example,
 * if THRUST_TARGET_KGF = 1, and THRUST_PERCENT_MARGIN = 0.25,
 * then propeller power would increase when thrust < 0.875 AND
 * propeller power would only decrease when thrust > 1.125.
 * Note that 1.125 - 0.875 = 0.25.
 */
var THRUST_PERCENT_MARGIN = 0.10;

/* If thrust is too large or too small, the ESC output period
 * will be changed by this much. If this value is small, it may
 * take a long time to reach your desired thrust. If this value
 * is too large, the thrust may just oscillate above and below
 * your target range, never falling within it.
 */
var OUTPUT_PERIOD_US_DELTA = 25;

/* When the PWM output changes to change the propeller speed,
 * it takes a bit of time from when the PWM output is changed
 * to when the thrust actually changes. This variable represents
 * the time to take between changing the PWM output and the next
 * reading of the thrust.
 */ 
var THRUST_CHANGE_SETTLING_TIME_SECONDS = 3;

/* This code will warm first enter a "warm-up" phase to get current
 * flowing. This will be a relatively small thrust. After this, a
 * takeoff will be simulated, during which maximum thrust will be
 * specified. After this, the system will feed back and calibrate 
 * in order to output a constant thrust.
 *
 * The following three constants define how long each of these phases
 * should last.
 */
var WARMUP_TIME_SECONDS = 10;
var TAKEOFF_TIME_SECONDS = 20;
var TIME_TO_MAINTAIN_TARGET_THRUST_SECONDS = 60;


// Constants above ^^
// Variables below vv


/* These are global variables which are expected to be read and
 * set throughout program execution.
 * 
 *   curThrust : the most recently read thrust measurement(in kgf)
 *   curOutputPeriod : the most recently PWM period output to
 *       the ESC in microseconds
 *   timeThrustMaintainedSeconds : The amount of time the target
 *       thrust has been maintained so far. It seems that RCBenchmark
 *       has no way to measure actual time, so the time measurement
 *       will be approximations based on
 *       THRUST_CHANGE_SETTLING_TIME_SECONDS * (num times thrust
 *              measured and set)
 */
var curThrust = 99999;
var curOutputPeriod = OUTPUT_PERIOD_US_MIN;
var timeThrustMaintainedSeconds = 0;
var timeSpentInTakefoff = 0;
var timeSpentWarmingUp = 0;


// ==================================================================
// ==================================================================
// ========================= CODE STARTS! ===========================
// ==================================================================
// ==================================================================
// Open new log file
rcb.files.newLogFile({prefix:filePrefix});
// Initialize ESC
rcb.console.print("Initializing ESC!");
curOutputPeriod = OUTPUT_PERIOD_US_MIN;
rcb.output.pwm("esc", OUTPUT_PERIOD_US_MIN); // <-- 1000 is baseline
rcb.wait(initializeTest, 4); // Wait 4 seconds, then callback to initializeTest


function earlyExit() {
    rcb.console.print("EXITING EARLY");
    rcb.endScript();
}

function initializeTest() {
    rcb.console.print("Taking initial thrust measurement");
    rcb.console.setVerbose(true);
    rcb.sensors.read(readAndUpdateThrust,10); // Read and average 10 samples
    rcb.wait(maintainThrust, 1); // Wait 1 second then start the main loop/body of the test
}

function readAndUpdateThrust(result){
    var thrust = result.thrust.displayValue;
    var unit = result.thrust.displayUnit;
    if(unit != "kgf") {
        rcb.console.print("Want thrust in units of kgf, but got units of " + unit);
        earlyExit();
    }
    curThrust = thrust.toPrecision(5);
    rcb.console.print("Thrust: " + thrust.toPrecision(3) + " " + unit);
}

function setOutputPeriod(period) {
    if(period > OUTPUT_PERIOD_US_MAX) {
        period = OUTPUT_PERIOD_US_MAX;
    }
    if(period < OUTPUT_PERIOD_US_MIN) {
        period = OUTPUT_PERIOD_US_MIN;
    }
    curOutputPeriod = period;
    rcb.output.pwm("esc", curOutputPeriod);
}
function maintainThrust() {
    rcb.console.print("Top of loop!");
    if (timeSpentWarmingUp < WARMUP_TIME_SECONDS) {
        setOutputPeriod(1200);
        timeSpentWarmingUp += THRUST_CHANGE_SETTLING_TIME_SECONDS;

    } else if (timeSpentInTakefoff < TAKEOFF_TIME_SECONDS){
        setOutputPeriod(OUTPUT_PERIOD_US_MAX);
        timeSpentInTakefoff += THRUST_CHANGE_SETTLING_TIME_SECONDS;

    } else {
        rcb.sensors.read(readAndUpdateThrust,10); // Read and average 10 samples
        rcb.console.print("curThrust = " + curThrust);
        rcb.console.print("THRUST_TARGET_KGF = " + THRUST_TARGET_KGF);
        rcb.console.print("curOutputPeriod = " + curOutputPeriod);
        var upperBound = THRUST_TARGET_KGF*(1.0 + THRUST_PERCENT_MARGIN/2.0);
        var lowerBound = THRUST_TARGET_KGF*(1.0 - THRUST_PERCENT_MARGIN/2.0);
        if(curThrust < lowerBound) {
            rcb.console.print("curThrust < " + lowerBound + ". Increasing output.");
            setOutputPeriod(curOutputPeriod + OUTPUT_PERIOD_US_DELTA);
        } else if(curThrust > upperBound) {
            rcb.console.print("curThrust > " + upperBound + ". Decreasing output");
            setOutputPeriod(curOutputPeriod - OUTPUT_PERIOD_US_DELTA);
        } else { // Thrust in target range.
            // Nothing
        }
        timeThrustMaintainedSeconds += THRUST_CHANGE_SETTLING_TIME_SECONDS;
        rcb.console.print("=================================");
        if(timeThrustMaintainedSeconds >= TIME_TO_MAINTAIN_TARGET_THRUST_SECONDS + 20) {
            rcb.console.print("Target thrust range met for at least " + TIME_TO_MAINTAIN_TARGET_THRUST_SECONDS + " seconds.");
            earlyExit();
        }
    }
    rcb.wait(maintainThrust, THRUST_CHANGE_SETTLING_TIME_SECONDS);    
}