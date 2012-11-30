package com.fluxtream.mvc.controllers;

import javax.servlet.http.HttpServletRequest;
import com.fluxtream.Configuration;
import com.fluxtream.utils.RequestUtils;
import org.apache.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.ModelAndView;

@Controller
public class TestController {
    Logger logger = Logger.getLogger(TestController.class);

    @Autowired
    Configuration env;

    @RequestMapping(value = "/test/unit")
    public ModelAndView unit(HttpServletRequest request) {
        // check that we're running locally
        if (!RequestUtils.isDev(request)) {
            return new ModelAndView("redirect:/welcome");
        }
        ModelAndView mav = new ModelAndView("test/unit");
        String release = env.get("release");
        mav.addObject("release", release);
        return mav;
    }
}
