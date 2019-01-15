
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
var THRUST_TARGET_KGF = 0.5;

/* The percent error that is acceptable in thrust. For example,
 * if THRUST_TARGET_KGF = 1, and THRUST_PERCENT_MARGIN = 0.25,
 * then propeller power would increase when thrust < 0.875 AND
 * propeller power would only decrease when thrust > 1.125.
 * Note that 1.125 - 0.875 = 0.25.
 */
var THRUST_PERCENT_MARGIN = 0.25;

/* If thrust is too large or too small, the ESC output period
 * will be changed by this much. If this value is small, it may
 * take a long time to reach your desired thrust. If this value
 * is too large, the thrust may just oscillate above and below
 * your target range, never falling within it.
 */
var OUTPUT_PERIOD_US_DELTA = 25;

/* These are global variables which are expected to be read and
 * set throughout program execution.
 * 
 *   curThrust : the most recently read thrust measurement(in kgf)
 *   curOutputPeriod : the most recently PWM period output to
 *       the ESC in microseconds
 */
var curThrust = 99999;
var curOutputPeriod = OUTPUT_PERIOD_US_MIN;




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

        rcb.console.print("4444");
    rcb.wait(loopTest, 1); // Wait 1 second then start the main loop/body of the test
        rcb.console.print("5555");
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



function loopTest() {
    rcb.console.print("Top of loop!");

    rcb.sensors.read(readAndUpdateThrust,10); // Read and average 10 samples
    rcb.console.print("curThrust = " + curThrust);
    rcb.console.print("THRUST_TARGET_KGF = " + THRUST_TARGET_KGF);
    rcb.console.print("curOutputPeriod = " + curOutputPeriod);

    var upperBound = THRUST_TARGET_KGF*(1.0 + THRUST_PERCENT_MARGIN/2.0);
    var lowerBound = THRUST_TARGET_KGF*(1.0 - THRUST_PERCENT_MARGIN/2.0);

    if(curThrust < lowerBound) {
        rcb.console.print("curThrust < " + lowerBound + ". Increasing output.");
        setOutputPeriod(curOutputPeriod + OUTPUT_PERIOD_US_DELTA);
    } else if(curThrust > THRUST_TARGET_KGF*(1.0+THRUST_PERCENT_MARGIN/2.0)) {
        rcb.console.print("curThrust > " + upperBound + ". Decreasing output");
        setOutputPeriod(curOutputPeriod - OUTPUT_PERIOD_US_DELTA);
    }

    rcb.console.print("=================================");

    rcb.wait(loopTest, 3);    
}

